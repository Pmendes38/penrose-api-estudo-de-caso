// src/modules/auth/dto/register.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength, IsStrongPassword } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @Transform(({ value }) => String(value).trim())
  name!: string;

  @ApiProperty({ example: 'contato@example.com' })
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @ApiPropertyOptional({ example: '(00) 00000-0000' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === undefined ? value : String(value).trim()))
  phone?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsStrongPassword({ minLength: 8, minNumbers: 1, minLowercase: 1, minUppercase: 0, minSymbols: 0 })
  password!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean = true;
}
