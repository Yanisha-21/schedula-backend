import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetSlotsQueryDto {
  @IsString()
  @IsNotEmpty()
  date!: string; // YYYY-MM-DD

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  duration?: number = 30; // default 30 mins
}