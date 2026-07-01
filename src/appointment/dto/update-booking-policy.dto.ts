import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  Max,
} from 'class-validator';

export class UpdateBookingPolicyDto {
  // ── Day 19 ──────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'consultationStartTime must be HH:MM (e.g. "09:00")' })
  consultationStartTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'consultationEndTime must be HH:MM (e.g. "17:00")' })
  consultationEndTime?: string;

  @IsOptional()
  @IsString()
  timezone?: string;   // IANA string, e.g. "Asia/Kolkata"

  // ── Day 20 ──────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  allowFutureBooking?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'maxFutureBookingDays must be at least 1.' })
  @Max(365, { message: 'maxFutureBookingDays cannot exceed 365.' })
  maxFutureBookingDays?: number | null;
}