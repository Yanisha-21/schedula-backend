import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReminderService } from './reminder.service';
import { Appointment } from '../appointment/entities/appointment.entity';
import { WaveSchedule } from '../doctor/entities/wave-schedule.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, WaveSchedule]),
    NotificationModule,
  ],
  providers: [ReminderService],
})
export class ReminderModule {}