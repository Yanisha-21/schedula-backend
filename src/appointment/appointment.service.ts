import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { checkBookingWindow } from './utils/booking-window.util';

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
    private readonly notificationService: NotificationService,
  ) {}

  // ── BOOK APPOINTMENT ────────────────────────────────────────────────────────
  async bookAppointment(user: User, dto: CreateAppointmentDto) {
    const patient = await this.patientRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (!patient) throw new NotFoundException('Patient profile not found.');

    const doctor = await this.doctorRepo.findOne({
      where: { id: dto.doctorId },
    });
    if (!doctor)
      throw new NotFoundException(`Doctor with ID ${dto.doctorId} not found.`);

    // ── 1. Date format ─────────────────────────────────────────────────────
    const appointmentDate = new Date(dto.date);
    if (isNaN(appointmentDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time.');
    }

    // ── BOOKING WINDOW VALIDATION (DAY 18) ──
    // Only today's date is allowed — past and future dates are rejected
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD in UTC

    // ── 2. Past date: always rejected ──────────────────────────────────────
    if (dto.date < todayStr) {
      throw new BadRequestException('Booking for past dates is not allowed.');
    }

    // ── 3. Day 20 — future booking policy ──────────────────────────────────
    if (dto.date > todayStr) {
      if (!doctor.allowFutureBooking) {
        throw new BadRequestException(
          'This doctor does not accept future appointments. Please book for today only.',
        );
      }

      const maxDays =
        doctor.maxFutureBookingDays != null && doctor.maxFutureBookingDays > 0
          ? doctor.maxFutureBookingDays
          : 7;

      const maxAllowedDate = new Date(today);
      maxAllowedDate.setDate(maxAllowedDate.getDate() + maxDays);
      const maxAllowedStr = maxAllowedDate.toISOString().split('T')[0];

      if (dto.date > maxAllowedStr) {
        throw new BadRequestException(
          `Booking is only allowed up to ${maxDays} day(s) in advance. ` +
          `The latest allowed date is ${maxAllowedStr}.`,
        );
      }
    }
    // ── END DAY 18 VALIDATION ──

    // ── TIME-BASED BOOKING WINDOW (DAY 19) ──
    // Determine the doctor's consultation window for today (custom override takes priority over recurring).
    // Booking window = [consultationStart - 2 hours, consultationEnd - 1 hour]
    const dayOfWeekForWindow = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' });

    const customForWindow = await this.customRepo.find({
      where: { doctor: { id: dto.doctorId }, date: dto.date },
    });

    let consultationWindows: { startTime: string; endTime: string }[] = [];

    if (customForWindow.length > 0) {
      consultationWindows = customForWindow.map((c) => ({ startTime: c.startTime, endTime: c.endTime }));
    } else {
      const recurringForWindow = await this.recurringRepo.find({
        where: { doctor: { id: dto.doctorId }, dayOfWeek: dayOfWeekForWindow },
      });
      consultationWindows = recurringForWindow.map((r) => ({ startTime: r.startTime, endTime: r.endTime }));
    }

    if (consultationWindows.length === 0) {
      throw new BadRequestException('Doctor is unavailable today. No consultation schedule configured.');
    }

    // Earliest start and latest end across all windows define the consultation period
    const consultationStart = consultationWindows
      .map((w) => w.startTime)
      .sort()[0];
    const consultationEnd = consultationWindows
      .map((w) => w.endTime)
      .sort()
      .slice(-1)[0];

    // Validate the consultation timings themselves
    if (consultationStart >= consultationEnd) {
      throw new BadRequestException('Invalid consultation timings configured for this doctor.');
    }

    // Compute booking window: open 2 hours before start, close 1 hour before end
    const consultationStartDateTime = new Date(`${dto.date}T${consultationStart}:00`);
    const consultationEndDateTime = new Date(`${dto.date}T${consultationEnd}:00`);

    const bookingOpensAt = new Date(consultationStartDateTime);
    bookingOpensAt.setHours(bookingOpensAt.getHours() - 2);

    const bookingClosesAt = new Date(consultationEndDateTime);
    bookingClosesAt.setHours(bookingClosesAt.getHours() - 1);

    const now = new Date();

    if (now < bookingOpensAt) {
      throw new BadRequestException(
        `Booking window has not opened yet. Booking opens at ${bookingOpensAt.toTimeString().slice(0, 5)}.`,
      );
    }

    if (now > bookingClosesAt) {
      throw new BadRequestException(
        `Booking window has closed. Booking closed at ${bookingClosesAt.toTimeString().slice(0, 5)}.`,
      );
    }
    // ── END DAY 19 VALIDATION ──

    const appointmentDateTime = new Date(`${dto.date}T${dto.startTime}:00`);
    if (appointmentDateTime <= new Date()) {
      throw new BadRequestException('Cannot book an appointment in the past.');
    }

    // ── 6. Wave scheduling ─────────────────────────────────────────────────
    if (doctor.schedulingType === SchedulingType.WAVE) {
      const dayOfWeek = appointmentDate.toLocaleDateString('en-US', {
        weekday: 'long',
      });
      const wave = await this.waveScheduleRepo.findOne({
        where: {
          doctor:    { id: doctor.id },
          dayOfWeek,
          startTime: dto.startTime,
          endTime:   dto.endTime,
        },
      });

      if (!wave)
        throw new NotFoundException('Wave slot not found for this time window.');

      if (wave.bookedCount >= wave.maxPatients) {
        throw new BadRequestException(
          'This wave is full. No more bookings allowed.',
        );
      }

      const existingWaveBooking = await this.appointmentRepo.findOne({
        where: {
          doctor:    { id: dto.doctorId },
          patient:   { id: patient.id },
          date:      dto.date,
          startTime: dto.startTime,
          status:    AppointmentStatus.BOOKED,
        },
      });
      if (existingWaveBooking)
        throw new BadRequestException('You have already booked this wave slot.');

      const tokenNumber   = wave.bookedCount + 1;
      wave.bookedCount    = tokenNumber;
      await this.waveScheduleRepo.save(wave);

      const appointment = this.appointmentRepo.create({
        doctor,
        patient,
        date:      dto.date,
        startTime: dto.startTime,
        endTime:   dto.endTime,
        status:    AppointmentStatus.BOOKED,
      });
      const saved = await this.appointmentRepo.save(appointment);

      await this.notificationService.createNotification(
        patient,
        'Appointment Booked',
        `Your appointment with ${doctor.fullName} has been booked successfully.`,
        NotificationType.APPOINTMENT_BOOKED,
      );

      return {
        ...saved,
        schedulingType: 'WAVE',
        tokenNumber,
        message: `Wave booked successfully. Your token number is ${tokenNumber}.`,
      };
    }

    // ── 7. Stream scheduling ───────────────────────────────────────────────
    const isValidSlot = await this.isSlotWithinAvailability(
      dto.doctorId,
      dto.date,
      dto.startTime,
      dto.endTime,
    );
    if (!isValidSlot) {
      throw new BadRequestException(
        'Selected slot is not within doctor availability.',
      );
    }

    const existing = await this.appointmentRepo.findOne({
      where: {
        doctor:    { id: dto.doctorId },
        date:      dto.date,
        startTime: dto.startTime,
        endTime:   dto.endTime,
        status:    AppointmentStatus.BOOKED,
      },
    });
    if (existing) throw new BadRequestException('This slot is already booked.');

    const appointment = this.appointmentRepo.create({
      doctor,
      patient,
      date:      dto.date,
      startTime: dto.startTime,
      endTime:   dto.endTime,
      status:    AppointmentStatus.BOOKED,
    });
    const savedAppointment = await this.appointmentRepo.save(appointment);

    await this.notificationService.createNotification(
      patient,
      'Appointment Booked',
      `Your appointment with ${doctor.fullName} has been booked successfully.`,
      NotificationType.APPOINTMENT_BOOKED,
    );

    return savedAppointment;
  }

  // ── RESCHEDULE APPOINTMENT ──────────────────────────────────────────────────
  async rescheduleAppointment(user: User, id: number, dto: CreateAppointmentDto) {
    const patient = await this.patientRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (!patient) throw new NotFoundException('Patient profile not found.');

    const appointment = await this.appointmentRepo.findOne({
      where:     { id },
      relations: { patient: true, doctor: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found.');

    if (appointment.patient.id !== patient.id) {
      throw new ForbiddenException(
        'You are not authorized to reschedule this appointment.',
      );
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot reschedule a cancelled appointment.',
      );
    }

    const appointmentDateTime = new Date(
      `${appointment.date}T${appointment.startTime}:00`,
    );
    const now         = new Date();
    const diffMinutes =
      (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutes < 30) {
      throw new BadRequestException(
        'Cannot reschedule within 30 minutes of appointment time.',
      );
    }

    if (
      appointment.date      === dto.date &&
      appointment.startTime === dto.startTime &&
      appointment.endTime   === dto.endTime
    ) {
      throw new BadRequestException(
        'New slot must be different from current slot.',
      );
    }

    const newDateTime = new Date(`${dto.date}T${dto.startTime}:00`);
    if (newDateTime <= now) {
      throw new BadRequestException('Cannot reschedule to a past date/time.');
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time.');
    }

    const doctor   = appointment.doctor;
    const todayStr = now.toISOString().split('T')[0];

    // ── Day 20: apply future booking policy to the NEW date ────────────────
    if (dto.date > todayStr) {
      if (!doctor.allowFutureBooking) {
        throw new BadRequestException(
          'This doctor does not accept future appointments. Please reschedule to today only.',
        );
      }

      const maxDays =
        doctor.maxFutureBookingDays != null && doctor.maxFutureBookingDays > 0
          ? doctor.maxFutureBookingDays
          : 7;

      const maxAllowedDate = new Date(now);
      maxAllowedDate.setDate(maxAllowedDate.getDate() + maxDays);
      const maxAllowedStr = maxAllowedDate.toISOString().split('T')[0];

      if (dto.date > maxAllowedStr) {
        throw new BadRequestException(
          `Rescheduling is only allowed up to ${maxDays} day(s) in advance. ` +
          `The latest allowed date is ${maxAllowedStr}.`,
        );
      }
    }

    // ── Day 19: apply booking window when rescheduling to today ───────────
    if (dto.date === todayStr) {
      const windowResult = checkBookingWindow(
        doctor.consultationStartTime,
        doctor.consultationEndTime,
        doctor.timezone,
      );
      if (!windowResult.allowed) {
        throw new BadRequestException(windowResult.reason);
      }
    }

    // ── Wave rescheduling ──────────────────────────────────────────────────
    if (doctor.schedulingType === SchedulingType.WAVE) {
      const newDate    = new Date(dto.date);
      const dayOfWeek  = newDate.toLocaleDateString('en-US', { weekday: 'long' });

      const newWave = await this.waveScheduleRepo.findOne({
        where: {
          doctor:    { id: doctor.id },
          dayOfWeek,
          startTime: dto.startTime,
          endTime:   dto.endTime,
        },
      });

      if (!newWave) {
        const allWaves     = await this.waveScheduleRepo.find({
          where: { doctor: { id: doctor.id }, dayOfWeek },
        });
        const availableWave = allWaves.find(w => w.bookedCount < w.maxPatients);
        if (availableWave) {
          throw new BadRequestException(
            `Requested wave not found. Suggested wave: ${availableWave.startTime} - ` +
            `${availableWave.endTime}, Available capacity: ` +
            `${availableWave.maxPatients - availableWave.bookedCount}`,
          );
        }
        throw new NotFoundException('No wave slot found for this time window.');
      }

      if (newWave.bookedCount >= newWave.maxPatients) {
        const allWaves      = await this.waveScheduleRepo.find({
          where: { doctor: { id: doctor.id }, dayOfWeek },
        });
        const availableWave = allWaves.find(
          w => w.bookedCount < w.maxPatients && w.id !== newWave.id,
        );
        if (availableWave) {
          throw new BadRequestException(
            `Requested wave is full. Suggested wave: ${availableWave.startTime} - ` +
            `${availableWave.endTime}, Available capacity: ` +
            `${availableWave.maxPatients - availableWave.bookedCount}`,
          );
        }
        throw new BadRequestException('This wave is full. No more bookings allowed.');
      }

      const oldDayOfWeek = new Date(appointment.date).toLocaleDateString(
        'en-US',
        { weekday: 'long' },
      );
      const oldWave = await this.waveScheduleRepo.findOne({
        where: {
          doctor:    { id: doctor.id },
          dayOfWeek: oldDayOfWeek,
          startTime: appointment.startTime,
          endTime:   appointment.endTime,
        },
      });
      if (oldWave && oldWave.bookedCount > 0) {
        oldWave.bookedCount -= 1;
        await this.waveScheduleRepo.save(oldWave);
      }

      const tokenNumber    = newWave.bookedCount + 1;
      newWave.bookedCount  = tokenNumber;
      await this.waveScheduleRepo.save(newWave);

      appointment.date      = dto.date;
      appointment.startTime = dto.startTime;
      appointment.endTime   = dto.endTime;
      await this.appointmentRepo.save(appointment);

      return {
        success:        true,
        message:        `Appointment rescheduled successfully. New token number: ${tokenNumber}`,
        appointment,
        tokenNumber,
        schedulingType: 'WAVE',
      };
    }

    // ── Stream rescheduling ────────────────────────────────────────────────
    const isValidSlot = await this.isSlotWithinAvailability(
      doctor.id,
      dto.date,
      dto.startTime,
      dto.endTime,
    );
    if (!isValidSlot) {
      const dayOfWeek = new Date(dto.date).toLocaleDateString('en-US', {
        weekday: 'long',
      });
      const recurring = await this.recurringRepo.find({
        where: { doctor: { id: doctor.id }, dayOfWeek },
      });
      if (recurring.length > 0) {
        throw new BadRequestException(
          `Slot not within availability. Doctor is available: ` +
          recurring.map(r => `${r.startTime} - ${r.endTime}`).join(', '),
        );
      }
      throw new BadRequestException(
        'Selected slot is not within doctor availability.',
      );
    }

    const existingBooking = await this.appointmentRepo.findOne({
      where: {
        doctor:    { id: doctor.id },
        date:      dto.date,
        startTime: dto.startTime,
        endTime:   dto.endTime,
        status:    AppointmentStatus.BOOKED,
      },
    });
    if (existingBooking) {
      throw new BadRequestException(
        `Requested slot ${dto.startTime}–${dto.endTime} is already booked. ` +
        `Please choose a different time slot.`,
      );
    }

    appointment.date      = dto.date;
    appointment.startTime = dto.startTime;
    appointment.endTime   = dto.endTime;
    await this.appointmentRepo.save(appointment);

    await this.notificationService.createNotification(
      patient,
      'Appointment Rescheduled',
      `Your appointment with ${doctor.fullName} has been rescheduled to ${dto.date} ${dto.startTime}.`,
      NotificationType.APPOINTMENT_RESCHEDULED,
    );

    return {
      success:        true,
      message:        'Appointment rescheduled successfully.',
      appointment,
      schedulingType: 'STREAM',
    };
  }

  // ── PATIENT: GET MY APPOINTMENTS ────────────────────────────────────────────
  async getMyAppointments(user: User) {
    const patient = await this.patientRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (!patient) throw new NotFoundException('Patient profile not found.');

    const appointments = await this.appointmentRepo.find({
      where:     { patient: { id: patient.id } },
      relations: { doctor: true },
      order:     { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0)
      throw new NotFoundException('No appointments found.');

    return {
      success: true,
      data: appointments.map(a => ({
        id:        a.id,
        doctor:    {
          id:             a.doctor.id,
          fullName:       a.doctor.fullName,
          specialization: a.doctor.specialization,
        },
        date:      a.date,
        startTime: a.startTime,
        endTime:   a.endTime,
        status:    a.status,
      })),
    };
  }

  // ── PATIENT: CANCEL APPOINTMENT ─────────────────────────────────────────────
  async cancelAppointment(user: User, id: number) {
    const patient = await this.patientRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (!patient) throw new NotFoundException('Patient profile not found.');

    const appointment = await this.appointmentRepo.findOne({
      where:     { id },
      relations: { patient: true },
    });
    if (!appointment) throw new NotFoundException('Appointment not found.');

    if (appointment.patient.id !== patient.id) {
      throw new ForbiddenException(
        'You are not authorized to cancel this appointment.',
      );
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled.');
    }

    const appointmentDateTime = new Date(
      `${appointment.date}T${appointment.startTime}:00`,
    );
    const now         = new Date();
    const diffMinutes =
      (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutes < 30) {
      throw new BadRequestException(
        'Cannot cancel within 30 minutes of appointment time.',
      );
    }

    if (appointmentDateTime <= now) {
      throw new BadRequestException('Cannot cancel a past appointment.');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appointment);

    await this.notificationService.createNotification(
      patient,
      'Appointment Cancelled',
      'Your appointment has been cancelled successfully.',
      NotificationType.APPOINTMENT_CANCELLED,
    );

    return { success: true, message: 'Appointment cancelled successfully.' };
  }

  // ── HELPER ──────────────────────────────────────────────────────────────────
  private async isSlotWithinAvailability(
    doctorId:  number,
    date:      string,
    startTime: string,
    endTime:   string,
  ): Promise<boolean> {
    const custom = await this.customRepo.find({
      where: { doctor: { id: doctorId }, date },
    });
    if (custom.length > 0) {
      return custom.some(
        c => startTime >= c.startTime && endTime <= c.endTime,
      );
    }
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
    });
    const recurring = await this.recurringRepo.find({
      where: { doctor: { id: doctorId }, dayOfWeek },
    });
    return recurring.some(
      r => startTime >= r.startTime && endTime <= r.endTime,
    );
  }
}