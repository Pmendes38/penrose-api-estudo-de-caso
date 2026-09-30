import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Refresh token da sessão atual (opcional se for enviado por header X-Refresh-Token ou cookie)',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({
    description: 'Se true, encerra TODAS as sessões do usuário (revoga todos os refresh).',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  all?: boolean = false;
}
