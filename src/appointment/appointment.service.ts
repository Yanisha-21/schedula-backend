import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { Doctor, SchedulingType } from '../doctor/entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import { WaveSchedule } from '../doctor/entities/wave-schedule.entity';
import { User } from '../users/entities/user.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(RecurringAvailability)
    private recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private customRepo: Repository<CustomAvailability>,
    @InjectRepository(WaveSchedule)
    private waveScheduleRepo: Repository<WaveSchedule>,
  ) {}

  // ── BOOK APPOINTMENT ──
  async bookAppointment(user: User, dto: CreateAppointmentDto) {
    const patient = await this.patientRepo.findOne({ where: { user: { id: user.id } } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const doctor = await this.doctorRepo.findOne({ where: { id: dto.doctorId } });
    if (!doctor) throw new NotFoundException(`Doctor with ID ${dto.doctorId} not found.`);

    const appointmentDate = new Date(dto.date);
    if (isNaN(appointmentDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time.');
    }

    const now = new Date();
    const appointmentDateTime = new Date(`${dto.date}T${dto.startTime}:00`);
    if (appointmentDateTime <= now) {
      throw new BadRequestException('Cannot book an appointment in the past.');
    }

    // ── WAVE SCHEDULING ──
    if (doctor.schedulingType === SchedulingType.WAVE) {
      const dayOfWeek = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' });
      const wave = await this.waveScheduleRepo.findOne({
        where: {
          doctor: { id: doctor.id },
          dayOfWeek,
          startTime: dto.startTime,
          endTime: dto.endTime,
        },
      });

      if (!wave) throw new NotFoundException('Wave slot not found for this time window.');

      if (wave.bookedCount >= wave.maxPatients) {
        throw new BadRequestException('This wave is full. No more bookings allowed.');
      }

      const existingWaveBooking = await this.appointmentRepo.findOne({
        where: {
          doctor: { id: dto.doctorId },
          patient: { id: patient.id },
          date: dto.date,
          startTime: dto.startTime,
          status: AppointmentStatus.BOOKED,
        },
      });
      if (existingWaveBooking) throw new BadRequestException('You have already booked this wave slot.');

      const tokenNumber = wave.bookedCount + 1;
      wave.bookedCount = tokenNumber;
      await this.waveScheduleRepo.save(wave);

      const appointment = this.appointmentRepo.create({
        doctor,
        patient,
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: AppointmentStatus.BOOKED,
      });
      const saved = await this.appointmentRepo.save(appointment);

      return {
        ...saved,
        schedulingType: 'WAVE',
        tokenNumber,
        message: `Wave booked successfully. Your token number is ${tokenNumber}.`,
      };
    }

    // ── STREAM SCHEDULING ──
    const isValidSlot = await this.isSlotWithinAvailability(dto.doctorId, dto.date, dto.startTime, dto.endTime);
    if (!isValidSlot) {
      throw new BadRequestException('Selected slot is not within doctor availability.');
    }

    const existing = await this.appointmentRepo.findOne({
      where: {
        doctor: { id: dto.doctorId },
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: AppointmentStatus.BOOKED,
      },
    });
    if (existing) throw new BadRequestException('This slot is already booked.');

    const appointment = this.appointmentRepo.create({
      doctor,
      patient,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: AppointmentStatus.BOOKED,
    });

    return await this.appointmentRepo.save(appointment);
  }

  // ── HELPER ──
  private async isSlotWithinAvailability(doctorId: number, date: string, startTime: string, endTime: string): Promise<boolean> {
    const custom = await this.customRepo.find({ where: { doctor: { id: doctorId }, date } });
    if (custom.length > 0) {
      return custom.some((c) => startTime >= c.startTime && endTime <= c.endTime);
    }
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const recurring = await this.recurringRepo.find({ where: { doctor: { id: doctorId }, dayOfWeek } });
    return recurring.some((r) => startTime >= r.startTime && endTime <= r.endTime);
  }

  // ── PATIENT: GET MY APPOINTMENTS ──
  async getMyAppointments(user: User) {
    const patient = await this.patientRepo.findOne({ where: { user: { id: user.id } } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const appointments = await this.appointmentRepo.find({
      where: { patient: { id: patient.id } },
      relations: { doctor: true },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) throw new NotFoundException('No appointments found.');

    return {
      success: true,
      data: appointments.map((a) => ({
        id: a.id,
        doctor: {
          id: a.doctor.id,
          fullName: a.doctor.fullName,
          specialization: a.doctor.specialization,
        },
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
      })),
    };
  }

  // ── PATIENT: CANCEL APPOINTMENT ──
  async cancelAppointment(user: User, id: number) {
    const patient = await this.patientRepo.findOne({ where: { user: { id: user.id } } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: { patient: true },
    });

    if (!appointment) throw new NotFoundException('Appointment not found.');

    if (appointment.patient.id !== patient.id) {
      throw new ForbiddenException('You are not authorized to cancel this appointment.');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled.');
    }

    const appointmentDateTime = new Date(`${appointment.date}T${appointment.startTime}:00`);
    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException('Cannot cancel a past appointment.');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appointment);

    return { success: true, message: 'Appointment cancelled successfully.' };
  }

  // ── DOCTOR: GET APPOINTMENTS ──
  async getDoctorAppointments(user: User) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const appointments = await this.appointmentRepo.find({
      where: { doctor: { id: doctor.id } },
      relations: { patient: true },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) throw new NotFoundException('No appointments found.');

    return {
      success: true,
      data: appointments.map((a) => ({
        id: a.id,
        patient: { id: a.patient.id, fullName: a.patient.fullName },
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
      })),
    };
  }
}