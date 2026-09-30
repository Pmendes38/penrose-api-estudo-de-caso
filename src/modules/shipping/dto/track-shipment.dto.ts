import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TrackShipmentDto {
  @ApiProperty({ example: 'LB123456789BR' })
  @IsString() 
  @IsNotEmpty()
  trackingCode!: string;
}