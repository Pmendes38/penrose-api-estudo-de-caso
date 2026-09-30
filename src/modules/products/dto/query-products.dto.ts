import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '../enums/product-status.enum';

export class QueryProductsDto {
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString() 
  search?: string;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString() 
  category?: string;
  
  @ApiPropertyOptional({ enum: ProductStatus }) 
  @IsOptional() 
  @IsEnum(ProductStatus) 
  status?: ProductStatus;

  
  @ApiPropertyOptional({ description: 'min price in cents' }) 
  @IsOptional() 
  @Type(() => Number) 
  @IsNumber() 
  @Min(0) 
  minPrice?: number;
  
  @ApiPropertyOptional({ description: 'max price in cents' }) 
  @IsOptional() 
  @Type(() => Number) 
  @IsNumber() 
  @Min(0) 
  maxPrice?: number;

  
  @ApiPropertyOptional() 
  @IsOptional() 
  @Type(() => Number) 
  @IsNumber() 
  @Min(1) 
  page?: number = 1;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @Type(() => Number) 
  @IsNumber() 
  @Min(1) 
  pageSize?: number = 20;

  
  @ApiPropertyOptional({ description: 'sort field (priceCents|createdAt|name)' })
  @IsOptional() 
  @IsString() 
  sortBy?: 'priceCents' | 'createdAt' | 'name' = 'createdAt';

  
  @ApiPropertyOptional({ description: 'sort direction (asc|desc)' })
  @IsOptional() 
  @IsString() 
  sortDir?: 'asc' | 'desc' = 'desc';
}