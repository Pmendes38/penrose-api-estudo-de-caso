import {
  IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber,
  IsOptional, IsString, Min, Max, ArrayUnique
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CouponType } from '../enums/coupon-type.enum';

export class CreateCouponDto {
  @ApiProperty({ example: 'BLACKFRIDAY' })
  @IsString() @IsNotEmpty()
  @Transform(({ value }) => String(value).trim().toUpperCase())
  code!: string;

  @ApiProperty({ example: 'Black Friday 10% off' })
  @IsString() @IsNotEmpty()
  @Transform(({ value }) => String(value).trim())
  description!: string;

  @ApiProperty({ enum: CouponType })
  @IsEnum(CouponType)
  type!: CouponType;

  // PERCENT: 0–100  | FIXED: > 0 (em moeda)
  @ApiProperty({ example: 10 })
  @IsNumber() @Min(0.01)
  value!: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional() @IsNumber() @Min(0)
  minimumOrderValue?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional() @IsNumber() @Min(1)
  maxRedemptions?: number;

  @ApiProperty({ example: '2025-09-01T00:00:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2025-12-31T23:59:59.000Z' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ type: [String], example: ['prod_1','prod_2'] })
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true })
  productIds?: string[];

  @ApiPropertyOptional({ type: [String], example: ['P','M','G'] })
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true })
  sizes?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  active?: boolean = true;
}