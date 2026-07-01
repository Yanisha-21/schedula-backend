import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';

import { Doctor, SchedulingType } from './entities/doctor.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { WaveSchedule } from './entities/wave-schedule.entity';
import { Appointment, AppointmentStatus } from '../appointment/entities/appointment.entity';
import { User } from '../users/entities/user.entity';
import { GetDoctorsQueryDto } from './dto/get-doctors-query.dto';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { GetSlotsQueryDto } from './dto/get-slots-query.dto';
import { UpdateSchedulingTypeDto, CreateWaveScheduleDto, GetWaveSlotsQueryDto } from './dto/create-schedule.dto';
import { UpdateFutureBookingDto } from './dto/update-future-booking.dto';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    @InjectRepository(RecurringAvailability)
    private recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private customRepo: Repository<CustomAvailability>,
    @InjectRepository(WaveSchedule)
    private waveScheduleRepo: Repository<WaveSchedule>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
  ) { }

  // ── EXISTING METHODS ──

  async createProfile(user: User, body: any) {
    const existing = await this.doctorRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (existing) {
      throw new BadRequestException('Doctor profile already exists');
    }
    const doctor = this.doctorRepo.create({ ...body, user });
    return await this.doctorRepo.save(doctor);
  }

  async getProfile(user: User) {
    const profile = await this.doctorRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    return profile;
  }

  async updateProfile(user: User, body: any) {
    const profile = await this.doctorRepo.findOne({
      where: { user: { id: user.id } },
    });
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    Object.assign(profile, body);
    return await this.doctorRepo.save(profile);
  }

  async findAll(query: GetDoctorsQueryDto) {
    const { specialization, search, availability } = query;
    const page = !query.page || query.page < 1 ? 1 : query.page;
    const limit = !query.limit || query.limit < 1 ? 10 : query.limit;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (specialization) where.specialization = ILike(`%${specialization}%`);
    if (search) where.fullName = ILike(`%${search}%`);
    if (availability !== undefined) where.isAvailable = availability;
    const [doctors, total] = await this.doctorRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { id: 'ASC' },
      select: { id: true, fullName: true, specialization: true, experience: true, consultationFee: true, isAvailable: true },
    });
    if (doctors.length === 0) throw new NotFoundException('No doctors found matching the criteria.');
    return { success: true, total, page, limit, totalPages: Math.ceil(total / limit), data: doctors };
  }

  async findById(id: number) {
    const doctor = await this.doctorRepo.findOne({
      where: { id },
      select: { id: true, fullName: true, specialization: true, experience: true, qualification: true, consultationFee: true, availability: true, isAvailable: true, profileDetails: true },
    });
    if (!doctor) throw new NotFoundException(`Doctor with ID ${id} not found.`);
    return { success: true, data: doctor };
  }

  // ── AVAILABILITY METHODS ──

  async createRecurringAvailability(user: User, dto: CreateRecurringAvailabilityDto) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    const existing = await this.recurringRepo.find({ where: { doctor: { id: doctor.id }, dayOfWeek: dto.dayOfWeek } });
    for (const slot of existing) {
      if (dto.startTime < slot.endTime && dto.endTime > slot.startTime) {
        throw new BadRequestException('Time slot overlaps with existing availability');
      }
    }

    const availability = this.recurringRepo.create({ ...dto, doctor });
    return await this.recurringRepo.save(availability);
  }

  async getRecurringAvailability(user: User) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    const availability = await this.recurringRepo.find({ where: { doctor: { id: doctor.id } } });
    if (availability.length === 0) throw new NotFoundException('No availability found');
    return { success: true, data: availability };
  }

  async updateRecurringAvailability(user: User, id: number, dto: CreateRecurringAvailabilityDto) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const slot = await this.recurringRepo.findOne({ where: { id, doctor: { id: doctor.id } } });
    if (!slot) throw new NotFoundException('Availability slot not found');

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    Object.assign(slot, dto);
    return await this.recurringRepo.save(slot);
  }

  async deleteRecurringAvailability(user: User, id: number) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const slot = await this.recurringRepo.findOne({ where: { id, doctor: { id: doctor.id } } });
    if (!slot) throw new NotFoundException('Availability slot not found');

    await this.recurringRepo.remove(slot);
    return { success: true, message: 'Availability slot deleted successfully' };
  }

  async createCustomAvailability(user: User, dto: CreateCustomAvailabilityDto) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    const existing = await this.customRepo.find({ where: { doctor: { id: doctor.id }, date: dto.date } });
    for (const slot of existing) {
      if (dto.startTime < slot.endTime && dto.endTime > slot.startTime) {
        throw new BadRequestException('Time slot overlaps with existing availability for this date');
      }
    }

    const availability = this.customRepo.create({ ...dto, doctor });
    return await this.customRepo.save(availability);
  }

  async getAvailabilityByDate(user: User, date: string) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    if (!date) throw new BadRequestException('Date is required');

    const custom = await this.customRepo.find({ where: { doctor: { id: doctor.id }, date } });
    if (custom.length > 0) {
      return { success: true, type: 'custom', data: custom };
    }

    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const recurring = await this.recurringRepo.find({ where: { doctor: { id: doctor.id }, dayOfWeek } });
    if (recurring.length === 0) throw new NotFoundException('No availability found for this date');

    return { success: true, type: 'recurring', data: recurring };
  }

  // ── SLOT GENERATION (DAY 7) ──

  async getAvailableSlots(doctorId: number, query: GetSlotsQueryDto) {
    const { date, duration = 30 } = query;

    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException(`Doctor with ID ${doctorId} not found.`);

    const requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    requestedDate.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      throw new BadRequestException('Cannot fetch slots for a past date.');
    }

    if (duration < 5) {
      throw new BadRequestException('Invalid duration. Must be at least 5 minutes.');
    }

    const custom = await this.customRepo.find({
      where: { doctor: { id: doctorId }, date },
    });

    let availabilityWindows: { startTime: string; endTime: string }[] = [];

    if (custom.length > 0) {
      availabilityWindows = custom.map((c) => ({ startTime: c.startTime, endTime: c.endTime }));
    } else {
      const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
      const recurring = await this.recurringRepo.find({
        where: { doctor: { id: doctorId }, dayOfWeek },
      });

      if (recurring.length === 0) {
        throw new NotFoundException('No availability found for this date.');
      }

      availabilityWindows = recurring.map((r) => ({ startTime: r.startTime, endTime: r.endTime }));
    }

    const slots: { startTime: string; endTime: string }[] = [];
    const isToday = requestedDate.getTime() === today.getTime();
    const now = new Date();

    for (const window of availabilityWindows) {
      const [startH, startM] = window.startTime.split(':').map(Number);
      const [endH, endM] = window.endTime.split(':').map(Number);

      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      while (currentMinutes + duration <= endMinutes) {
        const slotStartH = Math.floor(currentMinutes / 60);
        const slotStartM = currentMinutes % 60;
        const slotEndMinutes = currentMinutes + duration;
        const slotEndH = Math.floor(slotEndMinutes / 60);
        const slotEndM = slotEndMinutes % 60;

        const slotStart = `${String(slotStartH).padStart(2, '0')}:${String(slotStartM).padStart(2, '0')}`;
        const slotEnd = `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`;

        if (isToday) {
          const slotDateTime = new Date(requestedDate);
          slotDateTime.setHours(slotStartH, slotStartM, 0, 0);
          if (slotDateTime <= now) {
            currentMinutes += duration;
            continue;
          }
        }

        slots.push({ startTime: slotStart, endTime: slotEnd });
        currentMinutes += duration;
      }
    }

    if (slots.length === 0) {
      throw new NotFoundException('No available slots for this date.');
    }

    return {
      success: true,
      doctorId,
      date,
      duration,
      totalSlots: slots.length,
      data: slots,
    };
  }

  // ── DOCTOR APPOINTMENTS (DAY 8 + DAY 12) ──

  async getDoctorAppointments(user: User, date?: string) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
      }
    }

    const whereClause: any = {
      doctor: { id: doctor.id },
      status: AppointmentStatus.BOOKED,
    };

    if (date) {
      whereClause.date = date;
    }

    const appointments = await this.appointmentRepo.find({
      where: whereClause,
      relations: { patient: true },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    if (appointments.length === 0) throw new NotFoundException('No appointments found.');

    return {
      success: true,
      data: appointments.map((a) => ({
        id: a.id,
        patient: {
          id: a.patient.id,
          fullName: a.patient.fullName,
          age: a.patient.age,
          gender: a.patient.gender,
          contactDetails: a.patient.contactDetails,
        },
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        schedulingType: doctor.schedulingType,
      })),
    };
  }

  // ── DOCTOR CANCEL APPOINTMENT (DAY 12) ──

  async doctorCancelAppointment(user: User, id: number) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    if (isNaN(id) || id < 1) {
      throw new BadRequestException('Invalid appointment ID.');
    }

    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: { doctor: true, patient: true },
    });

    if (!appointment) throw new NotFoundException('Appointment not found.');

    if (appointment.doctor.id !== doctor.id) {
      throw new ForbiddenException('You are not authorized to cancel this appointment.');
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled.');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    await this.appointmentRepo.save(appointment);

    return { success: true, message: 'Appointment cancelled successfully.' };
  }

  // ── SCHEDULING TYPE (DAY 9) ──

  async updateSchedulingType(user: User, dto: UpdateSchedulingTypeDto) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    doctor.schedulingType = dto.schedulingType;
    await this.doctorRepo.save(doctor);
    return { success: true, message: `Scheduling type updated to ${dto.schedulingType}`, schedulingType: dto.schedulingType };
  }

  // ── WAVE SCHEDULE (DAY 9) ──

  async createWaveSchedule(user: User, dto: CreateWaveScheduleDto) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    if (doctor.schedulingType !== SchedulingType.WAVE) {
      throw new BadRequestException('Doctor scheduling type must be WAVE to create wave schedule');
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    if (dto.maxPatients < 1) {
      throw new BadRequestException('Max patients must be at least 1');
    }

    const existing = await this.waveScheduleRepo.find({
      where: { doctor: { id: doctor.id }, dayOfWeek: dto.dayOfWeek },
    });

    for (const wave of existing) {
      if (dto.startTime < wave.endTime && dto.endTime > wave.startTime) {
        throw new BadRequestException('Wave schedule overlaps with existing wave');
      }
    }

    const wave = this.waveScheduleRepo.create({ ...dto, doctor });
    return await this.waveScheduleRepo.save(wave);
  }

  async getWaveSchedule(user: User) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    const waves = await this.waveScheduleRepo.find({ where: { doctor: { id: doctor.id } } });
    if (waves.length === 0) throw new NotFoundException('No wave schedules found');

    return { success: true, data: waves };
  }

  async getWaveSlots(doctorId: number, query: GetWaveSlotsQueryDto) {
    const { date } = query;

    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException(`Doctor with ID ${doctorId} not found.`);

    if (doctor.schedulingType !== SchedulingType.WAVE) {
      throw new BadRequestException('This doctor uses STREAM scheduling. Use /slots endpoint instead.');
    }

    const requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    requestedDate.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      throw new BadRequestException('Cannot fetch slots for a past date.');
    }

    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
    const waves = await this.waveScheduleRepo.find({
      where: { doctor: { id: doctorId }, dayOfWeek },
    });

    if (waves.length === 0) throw new NotFoundException('No wave schedule found for this date.');

    return {
      success: true,
      doctorId,
      date,
      schedulingType: 'WAVE',
      data: waves.map((w) => ({
        id: w.id,
        startTime: w.startTime,
        endTime: w.endTime,
        maxPatients: w.maxPatients,
        bookedCount: w.bookedCount,
        availableSlots: w.maxPatients - w.bookedCount,
        isFull: w.bookedCount >= w.maxPatients,
      })),
    };
  }

  async getStreamSlots(doctorId: number, query: any) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException(`Doctor with ID ${doctorId} not found.`);

    if (doctor.schedulingType !== SchedulingType.STREAM) {
      throw new BadRequestException('This doctor uses WAVE scheduling. Use /wave-slots endpoint instead.');
    }

    return this.getAvailableSlots(doctorId, query);
  }

  // ── NEXT AVAILABLE APPOINTMENT (DAY 13) ──

  async getNextAvailableSlots(doctorId: number, duration: number = 30) {
    // FIX 1: Validate doctor exists
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor) throw new NotFoundException(`Doctor with ID ${doctorId} not found.`);

    // FIX 2: Check doctor availability flag — if on leave/unavailable, reject immediately
    if (!doctor.isAvailable) {
      throw new BadRequestException(
        'Doctor is currently unavailable. Please try another doctor or check back later.',
      );
    }

    // Validate appointment duration
    if (duration < 5) {
      throw new BadRequestException('Invalid duration. Must be at least 5 minutes.');
    }

    // FIX 3: Validate scheduling type explicitly — reject unknown types
    if (
      doctor.schedulingType !== SchedulingType.STREAM &&
      doctor.schedulingType !== SchedulingType.WAVE
    ) {
      throw new BadRequestException(
        `Invalid scheduling type: ${doctor.schedulingType}. Must be STREAM or WAVE.`,
      );
    }

    // FIX 4: Count WORKING DAYS only (Mon–Fri), skip weekends
    // workingDaysSearched tracks how many Mon–Fri days we've checked
    // calendarDayOffset advances through calendar days including weekends
    const MAX_WORKING_DAYS = 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let workingDaysSearched = 0;
    let calendarDayOffset = 0;

    while (workingDaysSearched < MAX_WORKING_DAYS) {
      const searchDate = new Date(today);
      searchDate.setDate(today.getDate() + calendarDayOffset);
      calendarDayOffset++;

      const dayOfWeek = searchDate.toLocaleDateString('en-US', { weekday: 'long' });

      // Skip Saturday and Sunday — don't count them toward the 30 working days
      if (dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday') {
        continue;
      }

      // Only count Mon–Fri toward the working day limit
      workingDaysSearched++;

      const dateStr = searchDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const isToday = calendarDayOffset === 1; // first iteration is today

      // ── WAVE SCHEDULING ──
      if (doctor.schedulingType === SchedulingType.WAVE) {
        const waves = await this.waveScheduleRepo.find({
          where: { doctor: { id: doctorId }, dayOfWeek },
        });

        // No wave schedule for this day — skip
        if (waves.length === 0) continue;

        // Filter waves that still have open capacity
        const availableWaves = waves.filter((w) => w.bookedCount < w.maxPatients);

        // All waves full — skip
        if (availableWaves.length === 0) continue;

        return {
          success: true,
          doctorId,
          schedulingType: 'WAVE',
          nextAvailableDate: dateStr,
          data: availableWaves.map((w) => ({
            id: w.id,
            startTime: w.startTime,
            endTime: w.endTime,
            maxPatients: w.maxPatients,
            bookedCount: w.bookedCount,
            availableSlots: w.maxPatients - w.bookedCount,
          })),
        };
      }

      // ── STREAM SCHEDULING ──
      // Check custom availability first, then fall back to recurring
      const custom = await this.customRepo.find({
        where: { doctor: { id: doctorId }, date: dateStr },
      });

      let availabilityWindows: { startTime: string; endTime: string }[] = [];

      if (custom.length > 0) {
        availabilityWindows = custom.map((c) => ({ startTime: c.startTime, endTime: c.endTime }));
      } else {
        const recurring = await this.recurringRepo.find({
          where: { doctor: { id: doctorId }, dayOfWeek },
        });
        // No availability configured for this day — skip
        if (recurring.length === 0) continue;
        availabilityWindows = recurring.map((r) => ({ startTime: r.startTime, endTime: r.endTime }));
      }

      // Generate all possible slots for this day
      const allSlots: { startTime: string; endTime: string }[] = [];
      const now = new Date();

      for (const window of availabilityWindows) {
        const [startH, startM] = window.startTime.split(':').map(Number);
        const [endH, endM] = window.endTime.split(':').map(Number);

        let currentMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        while (currentMinutes + duration <= endMinutes) {
          const slotStartH = Math.floor(currentMinutes / 60);
          const slotStartM = currentMinutes % 60;
          const slotEndMinutes = currentMinutes + duration;
          const slotEndH = Math.floor(slotEndMinutes / 60);
          const slotEndM = slotEndMinutes % 60;

          const slotStart = `${String(slotStartH).padStart(2, '0')}:${String(slotStartM).padStart(2, '0')}`;
          const slotEnd = `${String(slotEndH).padStart(2, '0')}:${String(slotEndM).padStart(2, '0')}`;

          // Skip past slots if searching today
          if (isToday) {
            const slotDateTime = new Date(searchDate);
            slotDateTime.setHours(slotStartH, slotStartM, 0, 0);
            if (slotDateTime <= now) {
              currentMinutes += duration;
              continue;
            }
          }

          allSlots.push({ startTime: slotStart, endTime: slotEnd });
          currentMinutes += duration;
        }
      }

      // No slots generated for this day — skip
      if (allSlots.length === 0) continue;

      // Filter out already-booked slots using a Set for O(1) lookup
      const bookedAppointments = await this.appointmentRepo.find({
        where: {
          doctor: { id: doctorId },
          date: dateStr,
          status: AppointmentStatus.BOOKED,
        },
      });

      const bookedTimes = new Set(
        bookedAppointments.map((a) => `${a.startTime}-${a.endTime}`),
      );

      const availableSlots = allSlots.filter(
        (s) => !bookedTimes.has(`${s.startTime}-${s.endTime}`),
      );

      // All slots already booked — skip
      if (availableSlots.length === 0) continue;

      return {
        success: true,
        doctorId,
        schedulingType: 'STREAM',
        nextAvailableDate: dateStr,
        totalSlots: availableSlots.length,
        data: availableSlots,
      };
    }

    // Exhausted all 30 working days with no available slot
    throw new NotFoundException(
      'No appointments available in the next 30 working days. Please try again later.',
    );
  }
    async updateFutureBookingConfig(user: User, dto: UpdateFutureBookingDto) {
      const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
      if (!doctor) throw new NotFoundException('Doctor profile not found');

      doctor.allowFutureBooking = dto.allowFutureBooking;
      doctor.maxFutureBookingDays = dto.maxFutureBookingDays ?? null;

      await this.doctorRepo.save(doctor);

      return {
        success: true,
        message: 'Future booking config updated.',
        allowFutureBooking: doctor.allowFutureBooking,
        maxFutureBookingDays: doctor.maxFutureBookingDays,
      };
    
  }
}