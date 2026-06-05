import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from './roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  signup(@Body() body: any) {
    return this.authService.signup(body);
  }

  @Post('login')
  login(@Body() body: any) {
    return this.authService.login(body.email, body.password);
  }

  @Get('doctor/profile')
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['DOCTOR']))
  getDoctor() {
    return 'Doctor Access Granted';
  }

  @Get('patient/profile')
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['PATIENT']))
  getPatient() {
    return 'Patient Access Granted';
  }
}