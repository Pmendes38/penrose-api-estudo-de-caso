import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ValidateItemDto {
  @ApiProperty() 
  @IsString() 
  productId!: string;
  
  @ApiProperty() 
  @IsNumber() 
  @Min(1) 
  quantity!: number;
  
  @ApiProperty() 
  @IsNumber() 
  @Min(0) 
  unitPrice!: number;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString() 
  size?: string;
}

export class ValidateCouponDto {
  @ApiProperty() 
  @IsString() 
  @IsNotEmpty() 
  code!: string;

  @ApiPropertyOptional({ description: 'Total do carrinho (BRL)' })
  @IsOptional() 
  @IsNumber() 
  @Min(0) 
  cartTotal?: number;
  
  @ApiPropertyOptional({ type: [ValidateItemDto] })
  @IsOptional() 
  @IsArray() 
  @ValidateNested({ each: true }) @Type(() => ValidateItemDto)
  items?: ValidateItemDto[];
}
