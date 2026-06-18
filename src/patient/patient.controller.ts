import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
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
  createProfile(@Req() req, @Body() body: any) {
    return this.patientService.createProfile(req.user, body);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['PATIENT']))
  getProfile(@Req() req) {
    return this.patientService.getProfile(req.user);
  }

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['PATIENT']))
  updateProfile(@Req() req, @Body() body: any) {
    return this.patientService.updateProfile(req.user, body);
  }
}