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

    // 30 minute cutoff rule
    const appointmentDateTime = new Date(`${appointment.date}T${appointment.startTime}:00`);
    const now = new Date();
    const diffMinutes = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60);
    if (diffMinutes < 30) {
      throw new BadRequestException('Cannot cancel within 30 minutes of appointment time.');
    }

    if (appointmentDateTime <= now) {
      throw new BadRequestException('Cannot cancel a past appointment.');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appointment);

    return { success: true, message: 'Appointment cancelled successfully.' };
  }

  // ── RESCHEDULE APPOINTMENT (DAY 10) ──
  async rescheduleAppointment(user: User, id: number, dto: CreateAppointmentDto) {
    const patient = await this.patientRepo.findOne({ where: { user: { id: user.id } } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: { patient: true, doctor: true },
    });

    if (!appointment) throw new NotFoundException('Appointment not found.');

    if (appointment.patient.id !== patient.id) {
      throw new ForbiddenException('You are not authorized to reschedule this appointment.');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot reschedule a cancelled appointment.');
    }

    // 30 minute cutoff rule
    const appointmentDateTime = new Date(`${appointment.date}T${appointment.startTime}:00`);
    const now = new Date();
    const diffMinutes = (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60);
    if (diffMinutes < 30) {
      throw new BadRequestException('Cannot reschedule within 30 minutes of appointment time.');
    }

    if (appointment.date === dto.date && appointment.startTime === dto.startTime && appointment.endTime === dto.endTime) {
      throw new BadRequestException('New slot must be different from current slot.');
    }

    const newDateTime = new Date(`${dto.date}T${dto.startTime}:00`);
    if (newDateTime <= now) {
      throw new BadRequestException('Cannot reschedule to a past date/time.');
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time.');
    }

    const doctor = appointment.doctor;

    // ── WAVE RESCHEDULING ──
    if (doctor.schedulingType === SchedulingType.WAVE) {
      const newDate = new Date(dto.date);
      const dayOfWeek = newDate.toLocaleDateString('en-US', { weekday: 'long' });

      const newWave = await this.waveScheduleRepo.findOne({
        where: {
          doctor: { id: doctor.id },
          dayOfWeek,
          startTime: dto.startTime,
          endTime: dto.endTime,
        },
      });

      if (!newWave) {
        const allWaves = await this.waveScheduleRepo.find({
          where: { doctor: { id: doctor.id }, dayOfWeek },
        });
        const availableWave = allWaves.find(w => w.bookedCount < w.maxPatients);
        if (availableWave) {
          throw new BadRequestException(
            `Requested wave not found. Suggested wave: ${availableWave.startTime} - ${availableWave.endTime}, Available capacity: ${availableWave.maxPatients - availableWave.bookedCount}`
          );
        }
        throw new NotFoundException('No wave slot found for this time window.');
      }

      if (newWave.bookedCount >= newWave.maxPatients) {
        const allWaves = await this.waveScheduleRepo.find({
          where: { doctor: { id: doctor.id }, dayOfWeek },
        });
        const availableWave = allWaves.find(w => w.bookedCount < w.maxPatients && w.id !== newWave.id);
        if (availableWave) {
          throw new BadRequestException(
            `Requested wave is full. Suggested wave: ${availableWave.startTime} - ${availableWave.endTime}, Available capacity: ${availableWave.maxPatients - availableWave.bookedCount}`
          );
        }
        throw new BadRequestException('This wave is full. No more bookings allowed.');
      }

      const oldDate = new Date(appointment.date);
      const oldDayOfWeek = oldDate.toLocaleDateString('en-US', { weekday: 'long' });
      const oldWave = await this.waveScheduleRepo.findOne({
        where: {
          doctor: { id: doctor.id },
          dayOfWeek: oldDayOfWeek,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
        },
      });
      if (oldWave && oldWave.bookedCount > 0) {
        oldWave.bookedCount -= 1;
        await this.waveScheduleRepo.save(oldWave);
      }

      const tokenNumber = newWave.bookedCount + 1;
      newWave.bookedCount = tokenNumber;
      await this.waveScheduleRepo.save(newWave);

      appointment.date = dto.date;
      appointment.startTime = dto.startTime;
      appointment.endTime = dto.endTime;
      await this.appointmentRepo.save(appointment);

      return {
        success: true,
        message: `Appointment rescheduled successfully. New token number: ${tokenNumber}`,
        appointment,
        tokenNumber,
        schedulingType: 'WAVE',
      };
    }

    // ── STREAM RESCHEDULING ──
    const isValidSlot = await this.isSlotWithinAvailability(doctor.id, dto.date, dto.startTime, dto.endTime);
    if (!isValidSlot) {
      const dayOfWeek = new Date(dto.date).toLocaleDateString('en-US', { weekday: 'long' });
      const recurring = await this.recurringRepo.find({ where: { doctor: { id: doctor.id }, dayOfWeek } });
      if (recurring.length > 0) {
        throw new BadRequestException(
          `Slot not within availability. Doctor is available: ${recurring.map(r => `${r.startTime} - ${r.endTime}`).join(', ')}`
        );
      }
      throw new BadRequestException('Selected slot is not within doctor availability.');
    }

    const existingBooking = await this.appointmentRepo.findOne({
      where: {
        doctor: { id: doctor.id },
        date: dto.date,
        startTime: dto.startTime,
        endTime: dto.endTime,
        status: AppointmentStatus.BOOKED,
      },
    });

    if (existingBooking) {
      throw new BadRequestException(
        `Requested slot ${dto.startTime}-${dto.endTime} is already booked. Please choose a different time slot.`
      );
    }

    appointment.date = dto.date;
    appointment.startTime = dto.startTime;
    appointment.endTime = dto.endTime;
    await this.appointmentRepo.save(appointment);

    return {
      success: true,
      message: 'Appointment rescheduled successfully.',
      appointment,
      schedulingType: 'STREAM',
    };
  }
}