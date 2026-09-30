import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdatePreferencesDto {
  @IsOptional() 
  @IsString() 
  @Transform(({ value }) => value?.trim()) 
  locale?: string;
  
  @IsOptional() 
  @IsIn(['light', 'dark', 'system']) 
  theme?: 'light' | 'dark' | 'system';
  
  @IsOptional() 
  @IsBoolean() 
  newsletterOptIn?: boolean;
}
