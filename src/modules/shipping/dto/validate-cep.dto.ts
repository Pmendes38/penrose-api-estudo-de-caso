import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateCepDto {
  @ApiProperty({ example: '01310-100' })
  @IsString() 
  @IsNotEmpty()
  postalCode!: string;
}