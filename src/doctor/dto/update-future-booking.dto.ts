import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateFutureBookingDto {
  @IsBoolean()
  allowFutureBooking!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxFutureBookingDays?: number | null;
}