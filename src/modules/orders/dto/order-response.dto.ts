import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../enums/order-status.enum';

export class OrderDto {
  @ApiProperty()
  id!: string;
  
  @ApiProperty()
  orderNumber!: number;
  
  @ApiProperty()
  customerId!: string;
  
  @ApiProperty({ enum: OrderStatus }) 
  status!: OrderStatus;

  @ApiProperty()
  createdAt!: Date;
  
  @ApiProperty()
  updatedAt!: Date;
  
  @ApiProperty()
  subtotal!: number;
  
  @ApiProperty()
  shippingTotal!: number;
  
  @ApiProperty()
  discountTotal!: number;
  
  @ApiProperty()
  grandTotal!: number;
}

export class UpdateOrderStatusResponse {
  @ApiProperty()
  message!: string;
  
  @ApiProperty({ type: OrderDto }) 
  order!: OrderDto;
}