import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  
  @ApiProperty() 
  @IsString() 
  productId!: string;
  
  @ApiProperty() 
  @IsString() 
  name!: string;
  
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

export class CreateOrderDto {
  @IsOptional() @IsObject()
  shipping?: Record<string, any>;

  @IsOptional() @IsObject()
  shippingAddress?: Record<string, any>;
  
  @ApiProperty() 
  @IsUUID() 
  customerId!: string;
  
  @ApiProperty({ type: [CreateOrderItemDto] })
  
  @IsArray() 
  @ValidateNested({ each: true }) 
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  
  @ApiProperty() 
  @IsNumber() 
  @Min(0) 
  subtotal!: number;
  
  @ApiProperty() 
  @IsNumber() 
  @Min(0) 
  shippingTotal!: number;
  
  @ApiProperty() 
  @IsNumber() 
  @Min(0) 
  discountTotal!: number;
  
  @ApiProperty() 
  @IsNumber() 
  @Min(0) 
  grandTotal!: number;

  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString() 
  couponCode?: string;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString() 
  notes?: string;
}
