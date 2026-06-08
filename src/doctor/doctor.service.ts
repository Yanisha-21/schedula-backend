import { Injectable } from '@nestjs/common';

@Injectable()
export class DoctorService {
  private doctorProfile: any = null;

  createProfile(body: any) {
    if (this.doctorProfile) {
      return {
        message: 'Doctor profile already exists',
      };
    }

    this.doctorProfile = body;

    return {
      message: 'Doctor profile created successfully',
      data: this.doctorProfile,
    };
  }

  getProfile() {
    if (!this.doctorProfile) {
      return {
        message: 'Doctor profile not found',
      };
    }

    return this.doctorProfile;
  }

  updateProfile(body: any) {
    if (!this.doctorProfile) {
      return {
        message: 'Doctor profile not found',
      };
    }

    this.doctorProfile = {
      ...this.doctorProfile,
      ...body,
    };

    return {
      message: 'Doctor profile updated successfully',
      data: this.doctorProfile,
    };
  }
}