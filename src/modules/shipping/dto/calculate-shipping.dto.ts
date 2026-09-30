import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { AddressDto } from './address.dto';
import { PackageItemDto } from './package-item.dto';

export class CalculateShippingDto {
  @ApiProperty({ type: AddressDto })
  @ValidateNested() 
  @Type(() => AddressDto)
  destination!: AddressDto;

  @ApiProperty({ type: [PackageItemDto] })
  @IsArray() 
  @ValidateNested({ each: true }) 
  @Type(() => PackageItemDto)
  packages!: PackageItemDto[];

  @ApiPropertyOptional({ description: 'Cart total (BRL) for free shipping rules' })
  @IsOptional() 
  @IsNumber()
  cartTotal?: number;

  @ApiPropertyOptional({ description: 'Favor cheaper option (vs fastest)' })
  @IsOptional() 
  @IsBoolean()
  preferCheapest?: boolean;
}