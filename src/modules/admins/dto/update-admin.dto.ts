import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, MinLength, IsString, IsStrongPassword } from 'class-validator';

export class UpdateAdminDto {
  @ApiPropertyOptional({ example: 'New Name' })
  @IsOptional() @IsString()
  @Transform(({ value }) => String(value).trim())
  name?: string;

  @ApiPropertyOptional({ example: 'contato@example.com' })
  @IsOptional() @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email?: string;

  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional() @MinLength(8)
  @IsStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 0, minNumbers: 1, minSymbols: 0 }, { message: 'Weak password' })
  password?: string;
}
