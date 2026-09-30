import { IsOptional, IsString } from 'class-validator';

export class PrepareCheckoutDto {
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
