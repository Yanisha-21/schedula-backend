import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Doctor } from './doctor.entity';

@Entity()
export class CustomAvailability {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn()
  doctor!: Doctor;

  @Column()
  date!: string; // YYYY-MM-DD format

  @Column()
  startTime!: string; // HH:MM format

  @Column()
  endTime!: string;
}