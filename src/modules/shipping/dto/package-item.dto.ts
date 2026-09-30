import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class PackageItemDto {
  @ApiProperty({ description: 'Weight (kg)' })
  @Type(() => Number) 
  @IsNumber()
  @Min(0.01)
  weightKg!: number;

  @ApiProperty({ description: 'Width (cm)' })
  @Type(() => Number) 
  @IsNumber()
  @Min(1)
  widthCm!: number;

  @ApiProperty({ description: 'Height (cm)' })
  @Type(() => Number) 
  @IsNumber()
  @Min(1)
  heightCm!: number;

  @ApiProperty({ description: 'Length (cm)' })
  @Type(() => Number) 
  @IsNumber()
  @Min(1)
  lengthCm!: number;

  @ApiPropertyOptional({ description: 'Declared value (BRL)' })
  @Type(() => Number) 
  @IsOptional() 
  @IsNumber()
  @Min(0)
  declaredValue?: number;
}