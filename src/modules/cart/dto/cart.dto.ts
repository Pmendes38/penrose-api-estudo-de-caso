import { IsInt, IsOptional, IsString, Min, IsObject, IsNumber, IsBoolean, IsArray, ValidateNested, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class Dimensions {
  @IsOptional() @IsNumber()
  length: number;

  @IsOptional() @IsNumber()
  width: number;

  @IsOptional() @IsNumber()
  height: number;
}

export class CreateCartDto {}

export class AddItemDto {
  @IsString()
  sku!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsObject()
  variant?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  weightGrams?: number;

  @IsOptional()
  dimensions?: Dimensions;
}

export class UpdateItemDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsObject()
  variant?: Record<string, string>;
}

export class ApplyCouponDto {
  @IsString()
  code!: string;
}

export class ShippingQuoteDto {
  @IsObject()
  address!: Record<string, any>;
}

export class ShippingSelectTagDto {
  @IsString()
  tag!: string;

  @IsOptional()
  @IsUrl()
  url?: string;
}

export class ShippingSelectDto {
  address(arg0: string, expected: number | null, serviceCode: string, address: any) {
    throw new Error('Method not implemented.');
  }
  @IsString()
  serviceCode!: string;

  @IsOptional() @IsString()
  agencyId?: string;

  @IsOptional() @IsBoolean()
  receipt?: boolean;

  @IsOptional() @IsBoolean()
  ownHand?: boolean;

  @IsOptional() @IsBoolean()
  nonCommercial?: boolean;

  @IsOptional() @IsString()
  invoiceKey?: string;

  @IsOptional() @IsString()
  platform?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ShippingSelectTagDto)
  tags?: ShippingSelectTagDto[];
}
