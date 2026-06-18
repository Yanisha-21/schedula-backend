import { IsInt, IsString, IsNotEmpty } from 'class-validator';

export class CreateAppointmentDto {
  @IsInt()
  doctorId!: number;

  @IsString()
  @IsNotEmpty()
  date!: string; // YYYY-MM-DD

  @IsString()
  @IsNotEmpty()
  startTime!: string; // HH:MM

  @IsString()
  @IsNotEmpty()
  endTime!: string; // HH:MM
}