import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { Patient } from '../patient/entities/patient.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Patient])],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService], // exported so AppointmentService can use it
})
export class NotificationModule {}