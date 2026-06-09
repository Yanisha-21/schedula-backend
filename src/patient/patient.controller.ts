import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';

import { PatientService } from './patient.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';

@Controller('patient')
export class PatientController {
  constructor(private patientService: PatientService) {}

  @Post('profile')
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['PATIENT']))
  createProfile(@Body() body: any) {
    return this.patientService.createProfile(body);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['PATIENT']))
  getProfile() {
    return this.patientService.getProfile();
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['PATIENT']))
  updateProfile(@Body() body: any) {
    return this.patientService.updateProfile(body);
  }
}