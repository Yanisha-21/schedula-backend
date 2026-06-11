import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Doctor } from './doctor.entity';

@Entity()
export class RecurringAvailability {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn()
  doctor!: Doctor;

  @Column()
  dayOfWeek!: string; // Monday, Tuesday, etc.

  @Column()
  startTime!: string; // HH:MM format

  @Column()
  endTime!: string;
}