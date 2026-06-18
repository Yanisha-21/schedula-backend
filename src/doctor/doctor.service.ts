import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';   // ← add ILike

import { Doctor } from './entities/doctor.entity';
import { User } from '../users/entities/user.entity';
import { GetDoctorsQueryDto } from './dto/get-doctors-query.dto';  // ← add this

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepo: Repository<Doctor>,
  ) {}

  // ── YOUR EXISTING METHODS (unchanged) ──

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

  // ── NEW METHODS BELOW ──

  async findAll(query: GetDoctorsQueryDto) {
    const { specialization, search, availability } = query;

    // Safe pagination — default to 1 and 10 if missing or invalid
    const page = !query.page || query.page < 1 ? 1 : query.page;
    const limit = !query.limit || query.limit < 1 ? 10 : query.limit;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (specialization) {
      where.specialization = ILike(`%${specialization}%`);
    }

    if (search) {
      where.fullName = ILike(`%${search}%`);
    }

    if (availability !== undefined) {
      where.isAvailable = availability;
    }

    const [doctors, total] = await this.doctorRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { id: 'ASC' },
      select: {
  id: true,
  fullName: true,
  specialization: true,
  experience: true,
  consultationFee: true,
  isAvailable: true,
},
    });

    if (doctors.length === 0) {
      throw new NotFoundException('No doctors found matching the criteria.');
    }

    return {
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: doctors,
    };
  }

  async findById(id: number) {
    const doctor = await this.doctorRepo.findOne({
      where: { id },
      select: {
  id: true,
  fullName: true,
  specialization: true,
  experience: true,
  qualification: true,
  consultationFee: true,
  availability: true,
  isAvailable: true,
  profileDetails: true,
},
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found.`);
    }

    return { success: true, data: doctor };
  }
}