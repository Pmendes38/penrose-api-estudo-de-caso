import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class AddressDto {
  @ApiProperty({ example: '01310100' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{8}(-\d{3})?$/, { message: 'postalCode must have 8 digits (with or without hyphen)' })
  postalCode!: string;
}


