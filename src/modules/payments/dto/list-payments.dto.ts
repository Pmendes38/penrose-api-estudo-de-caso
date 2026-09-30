// src/modules/payments/dto/list-payments.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaymentStatus } from '../enums/payment-status.enum';
import { BillingType } from '../enums/billing-type.enum';

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Transform(({ value }) => Number(value))
  @IsOptional() @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Transform(({ value }) => Number(value))
  @IsOptional() @IsInt() @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional() @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: BillingType })
  @IsOptional() @IsEnum(BillingType)
  billingType?: BillingType;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  orderId?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  providerPaymentId?: string;
}
