import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { AppointmentModule } from './appointment/appointment.module';
import { NotificationModule } from './notification/notification.module';
import { User } from './users/entities/user.entity';
import { Doctor } from './doctor/entities/doctor.entity';
import { Patient } from './patient/entities/patient.entity';
import { RecurringAvailability } from './doctor/entities/recurring-availability.entity';
import { CustomAvailability } from './doctor/entities/custom-availability.entity';
import { Appointment } from './appointment/entities/appointment.entity';
import { WaveSchedule } from './doctor/entities/wave-schedule.entity';
import { Notification } from './notification/entities/notification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [
          User,
          Doctor,
          Patient,
          RecurringAvailability,
          CustomAvailability,
          Appointment,
          WaveSchedule,
          Notification,
        ],
        synchronize: false,
        ssl: {
          rejectUnauthorized: false,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    DoctorModule,
    PatientModule,
    AppointmentModule,
    NotificationModule,
  ],
})
export class AppModule {}