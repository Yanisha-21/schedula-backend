import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Appointment, AppointmentStatus } from '../appointment/entities/appointment.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { SchedulingType } from '../doctor/entities/doctor.entity';
import { WaveSchedule } from '../doctor/entities/wave-schedule.entity';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(WaveSchedule)
    private waveScheduleRepo: Repository<WaveSchedule>,
    private notificationService: NotificationService,
  ) {}

  // Runs every minute — checks for appointments within the next 60 minutes
  // Change CronExpression.EVERY_MINUTE to EVERY_HOUR for production
  @Cron(CronExpression.EVERY_MINUTE)
  async sendAppointmentReminders() {
    this.logger.log('Running appointment reminder cron job...');

    const now = new Date();

    // Define reminder window: next 60 minutes
    const reminderWindowStart = new Date(now);
    const reminderWindowEnd = new Date(now);
    reminderWindowEnd.setMinutes(reminderWindowEnd.getMinutes() + 60);

    // Today's date in YYYY-MM-DD format
    const todayStr = now.toISOString().split('T')[0];

    // Fetch all booked appointments for today that haven't had a reminder sent yet
    const appointments = await this.appointmentRepo.find({
      where: {
        date: todayStr,
        status: AppointmentStatus.BOOKED,
        reminderSent: false,
      },
      relations: { patient: true, doctor: true },
    });

    this.logger.log(`Found ${appointments.length} appointments to check for reminders`);

    for (const appointment of appointments) {
      // Build appointment datetime from date + startTime
      const appointmentDateTime = new Date(`${appointment.date}T${appointment.startTime}:00`);

      // Check if appointment falls within the reminder window
      if (appointmentDateTime >= reminderWindowStart && appointmentDateTime <= reminderWindowEnd) {

        let title = 'Appointment Reminder';
        let message = '';

        // ── WAVE SCHEDULING ──
        if (appointment.doctor.schedulingType === SchedulingType.WAVE) {
          // Find the wave to get the token number
          const appointmentDate = new Date(appointment.date);
          const dayOfWeek = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' });

          const wave = await this.waveScheduleRepo.findOne({
            where: {
              doctor: { id: appointment.doctor.id },
              dayOfWeek,
              startTime: appointment.startTime,
              endTime: appointment.endTime,
            },
          });

          const tokenNumber = wave ? wave.bookedCount : 'N/A';

          message = `Reminder: You have an appointment with ${appointment.doctor.fullName} today. Reporting Time: ${appointment.startTime}. Token Number: ${tokenNumber}.`;
        } else {
          // ── STREAM SCHEDULING ──
          message = `Reminder: You have an appointment with ${appointment.doctor.fullName} today on ${appointment.date} from ${appointment.startTime} to ${appointment.endTime}.`;
        }

        // Create the reminder notification
        await this.notificationService.createNotification(
          appointment.patient,
          title,
          message,
          NotificationType.APPOINTMENT_REMINDER,
        );

        // Mark reminder as sent so it doesn't fire again
        appointment.reminderSent = true;
        await this.appointmentRepo.save(appointment);

        this.logger.log(`Reminder sent for appointment ID ${appointment.id}`);
      }
    }

    this.logger.log('Appointment reminder cron job completed.');
  }
}