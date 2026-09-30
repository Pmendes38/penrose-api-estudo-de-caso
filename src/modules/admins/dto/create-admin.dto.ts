import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail, IsNotEmpty, MinLength, IsString, IsStrongPassword,
} from 'class-validator';

export class CreateAdminDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString() @IsNotEmpty()
  @Transform(({ value }) => String(value).trim())
  name!: string;

  @ApiProperty({ example: 'contato@example.com' })
  @IsEmail()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  email!: string;

  @ApiProperty({ minLength: 8 })
  @MinLength(8)
  @IsStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 0, minNumbers: 1, minSymbols: 0 }, { message: 'Weak password' })
  password!: string;
}