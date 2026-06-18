import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Controller('appointment')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  bookAppointment(@Req() req, @Body() dto: CreateAppointmentDto) {
    return this.appointmentService.bookAppointment(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyAppointments(@Req() req) {
    return this.appointmentService.getMyAppointments(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  cancelAppointment(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.appointmentService.cancelAppointment(req.user, id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/reschedule')
  rescheduleAppointment(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentService.rescheduleAppointment(req.user, id, dto);
  }
}