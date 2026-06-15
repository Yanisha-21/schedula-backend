import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';

import { Doctor } from './entities/doctor.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { User } from '../users/entities/user.entity';
import { GetDoctorsQueryDto } from './dto/get-doctors-query.dto';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { GetSlotsQueryDto } from './dto/get-slots-query.dto';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    @InjectRepository(RecurringAvailability)
    private recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private customRepo: Repository<CustomAvailability>,
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

  // Check whether the doctor exists
  const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
  if (!doctor) {
    throw new NotFoundException(`Doctor with ID ${doctorId} not found.`);
  }

  // Validate date format
  const requestedDate = new Date(date);
  if (isNaN(requestedDate.getTime())) {
    throw new BadRequestException('Invalid date format. Use YYYY-MM-DD.');
  }

  // Prevent fetching slots for past dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  requestedDate.setHours(0, 0, 0, 0);

  if (requestedDate < today) {
    throw new BadRequestException('Cannot fetch slots for a past date.');
  }

  // Validate slot duration
  if (duration < 5) {
    throw new BadRequestException(
      'Invalid duration. Must be at least 5 minutes.',
    );
  }

  // Check for custom availability first (override logic)
  const custom = await this.customRepo.find({
    where: { doctor: { id: doctorId }, date },
  });

  let availabilityWindows: { startTime: string; endTime: string }[] = [];

  if (custom.length > 0) {
    // Use custom availability if available
    availabilityWindows = custom.map((c) => ({
      startTime: c.startTime,
      endTime: c.endTime,
    }));
  } else {
    // Otherwise use recurring availability
    const dayOfWeek = requestedDate.toLocaleDateString('en-US', {
      weekday: 'long',
    });

    const recurring = await this.recurringRepo.find({
      where: { doctor: { id: doctorId }, dayOfWeek },
    });

    if (recurring.length === 0) {
      throw new NotFoundException('No availability found for this date.');
    }

    availabilityWindows = recurring.map((r) => ({
      startTime: r.startTime,
      endTime: r.endTime,
    }));
  }

  // Store generated slots
  const slots: { startTime: string; endTime: string }[] = [];

  // Check whether requested date is today
  const isToday = requestedDate.getTime() === today.getTime();
  const now = new Date();

  // Generate slots from availability windows
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

      // Filter past slots if requested date is today
      if (isToday) {
        const slotDateTime = new Date(requestedDate);
        slotDateTime.setHours(slotStartH, slotStartM, 0, 0);

        if (slotDateTime <= now) {
          currentMinutes += duration;
          continue;
        }
      }

      // Add available slot
      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
      });

      currentMinutes += duration;
    }
  }

  // Return error if no slots are available
  if (slots.length === 0) {
    throw new NotFoundException('No available slots for this date.');
  }

  // Return generated slots
  return {
    success: true,
    doctorId,
    date,
    duration,
    totalSlots: slots.length,
    data: slots,
  };
}
}