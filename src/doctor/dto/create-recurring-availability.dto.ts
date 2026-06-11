import { IsString, IsNotEmpty } from 'class-validator';

export class CreateRecurringAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  dayOfWeek!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;
}