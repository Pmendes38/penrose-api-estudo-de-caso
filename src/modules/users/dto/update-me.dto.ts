import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @Transform(({ value }) => (value === undefined ? value : String(value).trim()))
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @Transform(({ value }) => (value === undefined ? value : String(value).trim()))
  phone?: string;
}
