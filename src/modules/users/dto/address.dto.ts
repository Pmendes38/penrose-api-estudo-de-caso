import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAddressDto {
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  label?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  personName?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  phone?: string;

  
  @IsString() 
  @MinLength(3) 
  @Transform(({ value }) => String(value).trim())
  zipCode!: string;
  
  @IsString() 
  @MinLength(1) 
  @Transform(({ value }) => String(value).trim())
  street!: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  number?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  complement?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  neighborhood?: string;
  
  @IsString() 
  @Transform(({ value }) => String(value).trim())
  city!: string;
  
  @IsString() 
  @Transform(({ value }) => String(value).trim())
  state!: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => (value === undefined ? value : String(value).trim()))
  country?: string = 'BR';

  
  @IsOptional() 
  @IsBoolean() 
  isDefault?: boolean;
}

export class UpdateAddressDto {
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  label?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  personName?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  phone?: string;

  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  zipCode?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  street?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  number?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  complement?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  neighborhood?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  city?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  state?: string;
  
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim())
  country?: string;

  
  @IsOptional() 
  @IsBoolean() 
  isDefault?: boolean;
}
