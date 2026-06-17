import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Doctor } from './doctor.entity';

@Entity()
export class WaveSchedule {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn()
  doctor!: Doctor;

  @Column()
  dayOfWeek!: string; // Monday, Tuesday, etc.

  @Column()
  startTime!: string; // HH:MM

  @Column()
  endTime!: string; // HH:MM

  @Column()
  maxPatients!: number;

  @Column({ default: 0 })
  bookedCount!: number;
}