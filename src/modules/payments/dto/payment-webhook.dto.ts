import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '../enums/payment-status.enum';
import { BillingType } from '../enums/billing-type.enum';

export class PaymentWebhookDto {
  
  @ApiProperty() 
  @IsString() 
  @IsNotEmpty() 
  event!: string;
  
  @ApiProperty() 
  @IsString() 
  @IsNotEmpty() 
  providerPaymentId!: string;
  
  @ApiProperty({ enum: PaymentStatus }) 
  @IsEnum(PaymentStatus) 
  status!: PaymentStatus;
  
  @ApiProperty({ enum: BillingType }) 
  @IsEnum(BillingType) 
  billingType!: BillingType;
  
  @ApiProperty() 
  @IsNumber() 
  amount!: number;
  
  @ApiProperty() 
  @IsOptional() 
  @IsString() 
  orderId?: string;
  
  @ApiProperty() 
  @IsOptional() 
  @IsString() 
  signature?: string;
}