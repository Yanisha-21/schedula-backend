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

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
    @InjectRepository(RecurringAvailability)
    private recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private customRepo: Repository<CustomAvailability>,
  ) {}

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

  // ── NEW AVAILABILITY METHODS ──

  async createRecurringAvailability(user: User, dto: CreateRecurringAvailabilityDto) {
    const doctor = await this.doctorRepo.findOne({ where: { user: { id: user.id } } });
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    // Validate time range
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check for overlapping slots
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

    // Check for overlapping slots on same date
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

    // Check custom availability first
    const custom = await this.customRepo.find({ where: { doctor: { id: doctor.id }, date } });
    if (custom.length > 0) {
      return { success: true, type: 'custom', data: custom };
    }

    // Fall back to recurring availability
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    const recurring = await this.recurringRepo.find({ where: { doctor: { id: doctor.id }, dayOfWeek } });
    if (recurring.length === 0) throw new NotFoundException('No availability found for this date');

    return { success: true, type: 'recurring', data: recurring };
  }
}