import { IsString, IsNotEmpty } from 'class-validator';

export class CreateCustomAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;
}