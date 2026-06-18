import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  Param,
  Query,
  ParseIntPipe,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetDoctorsQueryDto } from './dto/get-doctors-query.dto';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { GetSlotsQueryDto } from './dto/get-slots-query.dto';
import { UpdateSchedulingTypeDto, CreateWaveScheduleDto, GetWaveSlotsQueryDto } from './dto/create-schedule.dto';

@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  createProfile(@Req() req, @Body() body: any) {
    return this.doctorService.createProfile(req.user, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req) {
    return this.doctorService.getProfile(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@Req() req, @Body() body: any) {
    return this.doctorService.updateProfile(req.user, body);
  }

  @Get()
  findAll(@Query() query: GetDoctorsQueryDto) {
    return this.doctorService.findAll(query);
  }

  // ── DOCTOR APPOINTMENTS (DAY 8) ──
  @UseGuards(JwtAuthGuard)
  @Get('appointments')
  getDoctorAppointments(@Req() req) {
    return this.doctorService.getDoctorAppointments(req.user);
  }

  // ── SCHEDULING TYPE (DAY 9) ──
  @UseGuards(JwtAuthGuard)
  @Patch('scheduling-type')
  updateSchedulingType(
    @Req() req,
    @Body() dto: UpdateSchedulingTypeDto,
  ) {
    return this.doctorService.updateSchedulingType(req.user, dto);
  }

  // ── WAVE SCHEDULE (DAY 9) ──
  @UseGuards(JwtAuthGuard)
  @Post('wave-schedule')
  createWaveSchedule(
    @Req() req,
    @Body() dto: CreateWaveScheduleDto,
  ) {
    return this.doctorService.createWaveSchedule(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('wave-schedule')
  getWaveSchedule(@Req() req) {
    return this.doctorService.getWaveSchedule(req.user);
  }

  // ── SLOT GENERATION (DAY 7) ──
  @Get(':doctorId/slots')
  getAvailableSlots(
    @Param(
      'doctorId',
      new ParseIntPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid doctor ID. ID must be a number.'),
      }),
    )
    doctorId: number,
    @Query() query: GetSlotsQueryDto,
  ) {
    return this.doctorService.getAvailableSlots(doctorId, query);
  }

  @Get(':doctorId/wave-slots')
  getWaveSlots(
    @Param(
      'doctorId',
      new ParseIntPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid doctor ID. ID must be a number.'),
      }),
    )
    doctorId: number,
    @Query() query: GetWaveSlotsQueryDto,
  ) {
    return this.doctorService.getWaveSlots(doctorId, query);
  }

  @Get(':doctorId/stream-slots')
  getStreamSlots(
    @Param(
      'doctorId',
      new ParseIntPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid doctor ID. ID must be a number.'),
      }),
    )
    doctorId: number,
    @Query() query: GetSlotsQueryDto,
  ) {
    return this.doctorService.getStreamSlots(doctorId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Post('availability')
  createRecurringAvailability(
    @Req() req,
    @Body() dto: CreateRecurringAvailabilityDto,
  ) {
    return this.doctorService.createRecurringAvailability(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('availability')
  getRecurringAvailability(@Req() req) {
    return this.doctorService.getRecurringAvailability(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('availability/:id')
  updateRecurringAvailability(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateRecurringAvailabilityDto,
  ) {
    return this.doctorService.updateRecurringAvailability(req.user, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('availability/:id')
  deleteRecurringAvailability(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.doctorService.deleteRecurringAvailability(req.user, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('availability/override')
  createCustomAvailability(
    @Req() req,
    @Body() dto: CreateCustomAvailabilityDto,
  ) {
    return this.doctorService.createCustomAvailability(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('availability/date')
  getAvailabilityByDate(@Req() req, @Query('date') date: string) {
    return this.doctorService.getAvailabilityByDate(req.user, date);
  }

  @Get(':id')
  findById(
    @Param(
      'id',
      new ParseIntPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid doctor ID. ID must be a number.'),
      }),
    )
    id: number,
  ) {
    return this.doctorService.findById(id);
  }
}