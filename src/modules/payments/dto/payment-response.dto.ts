import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../enums/payment-status.enum';
import { BillingType } from '../enums/billing-type.enum';

export class PaymentDto {
  @ApiProperty() 
  id!: string;
  
  @ApiProperty() 
  orderId!: string;
  
  @ApiProperty({ enum: BillingType })
  billingType!: BillingType;
  
  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;
  
  @ApiProperty() 
  amount!: number;
  
  @ApiProperty() 
  createdAt!: Date;
  
  @ApiProperty() 
  updatedAt!: Date;

  
  @ApiProperty({ required: false })
  provider!: 'ASAAS';
  
  @ApiProperty({ required: false })
  providerPaymentId?: string;
  
  @ApiProperty({ required: false })
  boletoUrl?: string;
  
  @ApiProperty({ required: false })
  identificatorField?: string;
  
  @ApiProperty({ required: false })
  pixPayload?: string;
}
