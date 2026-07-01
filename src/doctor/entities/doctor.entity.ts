import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SchedulingType {
  STREAM = 'STREAM',
  WAVE = 'WAVE',
}

@Entity()
export class Doctor {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  fullName!: string;

  @Column()
  specialization!: string;

  @Column()
  experience!: number;

  @Column()
  qualification!: string;

  @Column()
  consultationFee!: number;

  @Column()
  availability!: string;

  @Column({ default: true })
  isAvailable!: boolean;

  @Column({ nullable: true })
  profileDetails!: string;

  @Column({
    type: 'enum',
    enum: SchedulingType,
    default: SchedulingType.STREAM,
  })
  schedulingType!: SchedulingType;

  // ── DAY 19: Booking window ──────────────────────────────────────────────────
  // Booking opens  = consultationStartTime − 2 hours
  // Booking closes = consultationEndTime   − 1 hour
  // Both stored as HH:MM strings (24-hour). Null = no window enforcement.
  @Column({ nullable: true, type: 'varchar', length: 5 })
  consultationStartTime!: string | null;   // e.g. '09:00'

  @Column({ nullable: true, type: 'varchar', length: 5 })
  consultationEndTime!: string | null;     // e.g. '17:00'

  // IANA timezone string — defaults to UTC when null
  @Column({ nullable: true, type: 'varchar', length: 64 })
  timezone!: string | null;               // e.g. 'Asia/Kolkata'
  // ── END DAY 19 ─────────────────────────────────────────────────────────────

  // ── DAY 20: Future booking policy ──────────────────────────────────────────
  @Column({ default: false })
  allowFutureBooking!: boolean;

  @Column({ nullable: true, type: 'int' })
  maxFutureBookingDays!: number | null;
  // ── END DAY 20 ─────────────────────────────────────────────────────────────

  @OneToOne(() => User, (user) => user.doctor, { onDelete: 'CASCADE' })
  @JoinColumn()
  user!: User;
}