import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Appointment } from './entities/appointment.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import { WaveSchedule } from '../doctor/entities/wave-schedule.entity';
import { AppointmentController } from './appointment.controller';
import { AppointmentService } from './appointment.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      Doctor,           // already here — controller now also uses it
      Patient,
      RecurringAvailability,
      CustomAvailability,
      WaveSchedule,
    ]),
    NotificationModule,
  ],
  controllers: [AppointmentController],
  providers:   [AppointmentService],
})
export class AppointmentModule {}