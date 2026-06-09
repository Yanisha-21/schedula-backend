import { Injectable } from '@nestjs/common';

@Injectable()
export class PatientService {
  private patientProfile: any = null;

  createProfile(body: any) {
    if (this.patientProfile) {
      return {
        message: 'Patient profile already exists',
      };
    }

    this.patientProfile = body;

    return {
      message: 'Patient profile created successfully',
      data: this.patientProfile,
    };
  }

  getProfile() {
    if (!this.patientProfile) {
      return {
        message: 'Patient profile not found',
      };
    }

    return this.patientProfile;
  }

  updateProfile(body: any) {
    if (!this.patientProfile) {
      return {
        message: 'Patient profile not found',
      };
    }

    this.patientProfile = {
      ...this.patientProfile,
      ...body,
    };

    return {
      message: 'Patient profile updated successfully',
      data: this.patientProfile,
    };
  }
}