import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Patient } from './entities/patient.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
  ) {}

  // CREATE PATIENT PROFILE
  async createProfile(user: User, body: any) {
    const existing = await this.patientRepo.findOne({
      where: { user: { id: user.id } },
    });

    if (existing) {
      throw new BadRequestException('Patient profile already exists');
    }

    const patient = this.patientRepo.create({
      ...body,
      user,
    });

    return await this.patientRepo.save(patient);
  }

  // GET PATIENT PROFILE
  async getProfile(user: User) {
    const profile = await this.patientRepo.findOne({
      where: { user: { id: user.id } },
    });

    if (!profile) {
      throw new NotFoundException('Patient profile not found');
    }

    return profile;
  }

  // UPDATE PATIENT PROFILE
  async updateProfile(user: User, body: any) {
    const profile = await this.patientRepo.findOne({
      where: { user: { id: user.id } },
    });

    if (!profile) {
      throw new NotFoundException('Patient profile not found');
    }

    Object.assign(profile, body);

    return await this.patientRepo.save(profile);
  }
}