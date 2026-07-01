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
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppointmentService } from './appointment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateBookingPolicyDto } from './dto/update-booking-policy.dto';
import { Doctor } from '../doctor/entities/doctor.entity';
import {
  checkBookingWindow,
  computeBookingWindow,
  validateTimeFormat,
  BookingWindow,
} from './utils/booking-window.util';

@Controller('appointment')
export class AppointmentController {
  constructor(
    private readonly appointmentService: AppointmentService,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
  ) {}

  // ── NAMED ROUTES FIRST (before any /:id routes) ─────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyAppointments(@Req() req) {
    return this.appointmentService.getMyAppointments(req.user);
  }

  @Get('booking-window/:doctorId')
  async getBookingWindow(@Param('doctorId', ParseIntPipe) doctorId: number) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor)
      throw new NotFoundException(`Doctor with ID ${doctorId} not found.`);

    if (!doctor.consultationStartTime || !doctor.consultationEndTime) {
      return {
        success:    true,
        doctorId,
        configured: false,
        message:    'This doctor has no consultation times configured. Booking is unrestricted.',
      };
    }

    const result = checkBookingWindow(
      doctor.consultationStartTime,
      doctor.consultationEndTime,
      doctor.timezone,
    );

    let window: BookingWindow | null = null;
    try {
      window = computeBookingWindow(
        doctor.consultationStartTime,
        doctor.consultationEndTime,
      );
    } catch (_) {}

    return {
      success:               true,
      doctorId,
      configured:            true,
      timezone:              doctor.timezone ?? 'UTC',
      consultationStartTime: doctor.consultationStartTime,
      consultationEndTime:   doctor.consultationEndTime,
      bookingOpensAt:        window?.opensAt,
      bookingClosesAt:       window?.closesAt,
      currentlyOpen:         result.allowed,
      currentTimeLocal:      result.nowLocal,
      message:               result.allowed
        ? `Booking window is open. Closes at ${window?.closesAt}.`
        : result.reason,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('booking-policy/:doctorId')
  async updateBookingPolicy(
    @Param('doctorId', ParseIntPipe) doctorId: number,
    @Body() dto: UpdateBookingPolicyDto,
  ) {
    const doctor = await this.doctorRepo.findOne({ where: { id: doctorId } });
    if (!doctor)
      throw new NotFoundException(`Doctor with ID ${doctorId} not found.`);

    const newStart = dto.consultationStartTime ?? doctor.consultationStartTime;
    const newEnd   = dto.consultationEndTime   ?? doctor.consultationEndTime;

    if (newStart && newEnd) {
      try {
        validateTimeFormat(newStart, 'consultationStartTime');
        validateTimeFormat(newEnd,   'consultationEndTime');
        computeBookingWindow(newStart, newEnd);
      } catch (err: any) {
        throw new BadRequestException(err.message);
      }
    }

    if (dto.consultationStartTime !== undefined)
      doctor.consultationStartTime = dto.consultationStartTime;
    if (dto.consultationEndTime !== undefined)
      doctor.consultationEndTime = dto.consultationEndTime;
    if (dto.timezone !== undefined)
      doctor.timezone = dto.timezone;
    if (dto.allowFutureBooking !== undefined)
      doctor.allowFutureBooking = dto.allowFutureBooking;
    if (dto.maxFutureBookingDays !== undefined)
      doctor.maxFutureBookingDays = dto.maxFutureBookingDays;

    await this.doctorRepo.save(doctor);

    return {
      success: true,
      message: 'Booking policy updated successfully.',
      policy: {
        consultationStartTime: doctor.consultationStartTime,
        consultationEndTime:   doctor.consultationEndTime,
        timezone:              doctor.timezone,
        allowFutureBooking:    doctor.allowFutureBooking,
        maxFutureBookingDays:  doctor.maxFutureBookingDays,
      },
    };
  }

  // ── /:id ROUTES AFTER ───────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post()
  bookAppointment(@Req() req, @Body() dto: CreateAppointmentDto) {
    return this.appointmentService.bookAppointment(req.user, dto);
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