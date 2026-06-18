import { IsString, IsNotEmpty, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { SchedulingType } from '../entities/doctor.entity';

export class UpdateSchedulingTypeDto {
  @IsEnum(SchedulingType)
  schedulingType!: SchedulingType;
}

export class CreateWaveScheduleDto {
  @IsString()
  @IsNotEmpty()
  dayOfWeek!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsInt()
  @Min(1)
  maxPatients!: number;
}

export class GetWaveSlotsQueryDto {
  @IsString()
  @IsNotEmpty()
  date!: string;
}