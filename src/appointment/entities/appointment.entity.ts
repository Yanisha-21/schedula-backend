import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Doctor } from '../../doctor/entities/doctor.entity';
import { Patient } from '../../patient/entities/patient.entity';

export enum AppointmentStatus {
  BOOKED = 'BOOKED',
  CANCELLED = 'CANCELLED',
}

@Entity()
export class Appointment {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn()
  doctor!: Doctor;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn()
  patient!: Patient;

  @Column()
  date!: string; // YYYY-MM-DD

  @Column()
  startTime!: string; // HH:MM

  @Column()
  endTime!: string; // HH:MM

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.BOOKED,
  })
  status!: AppointmentStatus;

  // Tracks whether a reminder notification has already been sent
  // Prevents duplicate reminders from being created on subsequent cron runs
  @Column({ default: false })
  reminderSent!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}