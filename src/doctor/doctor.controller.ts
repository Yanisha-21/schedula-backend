import {
  Controller,
  Post,
  Get,
  Patch,
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

@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  // ── YOUR EXISTING PROTECTED ROUTES (unchanged) ──

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

  // ── NEW PUBLIC ROUTES BELOW ──

  // GET /doctor  →  list with filters + pagination
  @Get()
  findAll(@Query() query: GetDoctorsQueryDto) {
    return this.doctorService.findAll(query);
  }

  // GET /doctor/:id  →  single doctor by ID
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