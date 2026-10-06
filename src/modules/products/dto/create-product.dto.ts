import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min, Matches } from 'class-validator';
import { ProductStatus } from '../enums/product-status.enum';

export class CreateProductDto {
  
  @ApiProperty() 
  @IsString() 
  name!: string;

  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString() 
  category?: string;

  
  @ApiProperty({ description: 'Price in cents' }) 
  @IsNumber() 
  @Min(0)
  priceCents!: number;

  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsNumber() 
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ description: 'Produced on demand, without finite physical stock' })
  @IsOptional()
  @IsBoolean()
  madeToOrder?: boolean;

  
  @ApiPropertyOptional({ enum: ProductStatus }) 
  @IsOptional() 
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString()
  description?: string;

  
  @ApiPropertyOptional({ type: [String] }) 
  @IsOptional() 
  @IsArray()
  images?: string[];

  
  @ApiPropertyOptional({ type: [String] }) 
  @IsOptional() 
  @IsArray()
  tags?: string[];

  
  @ApiPropertyOptional({ description: 'SKU must be unique' })
  
  @IsOptional() 
  @IsString() 
  @Matches(/^[A-Z0-9-_.]+$/i)
  sku?: string;
}
