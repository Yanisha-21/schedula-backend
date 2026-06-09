import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
} from '@nestjs/common';

import { DoctorService } from './doctor.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';

@Controller('doctor')
export class DoctorController {
  constructor(private doctorService: DoctorService) {}

  @Post('profile')
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['DOCTOR']))
  createProfile(@Body() body: any) {
    return this.doctorService.createProfile(body);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['DOCTOR']))
  getProfile() {
    return this.doctorService.getProfile();
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['DOCTOR']))
  updateProfile(@Body() body: any) {
    return this.doctorService.updateProfile(body);
  }
}