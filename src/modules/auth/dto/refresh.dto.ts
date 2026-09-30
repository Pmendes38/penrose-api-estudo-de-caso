import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Refresh token (opcional se for enviado por header X-Refresh-Token ou cookie)' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}