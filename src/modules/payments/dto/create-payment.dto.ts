import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillingType } from '../enums/billing-type.enum';

export class CartItemDto {
  @ApiProperty() 
  @IsString() 
  productId!: string;
  
  @ApiProperty() 
  @IsString() 
  name!: string;
  
  @ApiProperty() 
  @IsInt() 
  @Min(1) 
  quantity!: number;
  
  @ApiProperty() 
  @IsNumber() 
  @Min(0) 
  unitPrice!: number;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString() 
  size?: string;
}

export class DiscountDto {
  @ApiProperty() 
  @IsNumber() 
  value!: number;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsInt() 
  @Min(0) 
  dueDateLimitDays?: number;
  
  @ApiPropertyOptional({ enum: ['PERCENTAGE', 'CURRENCY'] })
  @IsOptional() 
  @IsEnum(['PERCENTAGE', 'CURRENCY'] as any) 
  type?: 'PERCENTAGE' | 'CURRENCY';
}

export class FineDto {
  @ApiProperty() 
  @IsNumber() 
  value!: number;
}

export class InterestDto {
  @ApiProperty() 
  @IsNumber()
  value!: number;
}

export class CallbackDto {
  @ApiProperty() 
  @IsString() 
  successUrl!: string;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsBoolean() 
  autoRedirect?: boolean;
}

export class CreditCardDto {
  @ApiProperty() 
  @IsString() 
  holderName!: string;
  
  @ApiProperty() 
  @IsString() 
  number!: string;
  
  @ApiProperty() 
  @IsString() 
  expiryMonth!: string;
  
  @ApiProperty() 
  @IsString() 
  expiryYear!: string;
  
  @ApiProperty() 
  @IsString() 
  ccv!: string;
}

export class CreditCardHolderInfoDto {
  @ApiProperty() 
  @IsString() 
  name!: string;
  
  @ApiProperty() 
  @IsString() 
  email!: string;
  
  @ApiProperty() 
  @IsString() 
  cpfCnpj!: string;
  
  @ApiProperty() 
  @IsString() 
  postalCode!: string;
  
  @ApiProperty() 
  @IsString() 
  addressNumber!: string;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString() 
  addressComplement?: string;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString() 
  phone?: string;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsString() 
  mobilePhone?: string;
}

export class CreatePaymentDto {
  @ApiProperty({ type: [CartItemDto] })
  
  @IsArray() 
  @ValidateNested({ each: true }) 
  @Type(() => CartItemDto)
  cartItems!: CartItemDto[];
  
  @ApiProperty() 
  @IsNumber() 
  @Min(0) 
  totalAmount!: number;
  
  @ApiProperty({ enum: BillingType }) 
  @IsEnum(BillingType)
  billingType!: BillingType;

  @ApiProperty({ description: 'Dados básicos do cliente (usados p/ Asaas customer)' })
  @IsObject() 
  @IsNotEmpty()
  customerData!: Record<string, any>;
  
  @ApiPropertyOptional({ description: 'Frete selecionado (opcional)' })
  @IsOptional() 
  @IsObject()
  selectedShipping?: Record<string, any>;
  
  @ApiPropertyOptional({ description: 'ISO date para dueDate (boleto/pix). Se omitir, +3 dias.' })
  @IsOptional() 
  @IsString()
  dueDateIso?: string;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsInt() 
  @Min(2)
  installmentCount?: number;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsNumber() 
  @Min(0)
  installmentValue?: number;
  
  @ApiPropertyOptional() 
  @IsOptional() 
  @IsNumber() 
  @Min(0)
  totalValue?: number;
  
  @ApiPropertyOptional({ type: DiscountDto }) 
  @IsOptional() 
  @ValidateNested() 
  @Type(() => DiscountDto)
  discount?: DiscountDto;
  
  @ApiPropertyOptional({ type: FineDto }) 
  @IsOptional() 
  @ValidateNested() 
  @Type(() => FineDto)
  fine?: FineDto;
  
  @ApiPropertyOptional({ type: InterestDto }) 
  @IsOptional() 
  @ValidateNested() 
  @Type(() => InterestDto)
  interest?: InterestDto;

  
  @ApiPropertyOptional({ type: CallbackDto }) 
  @IsOptional() 
  @ValidateNested() 
  @Type(() => CallbackDto)
  callback?: CallbackDto;

  @ApiPropertyOptional({ type: CreditCardDto }) 
  @IsOptional() 
  @ValidateNested() 
  @Type(() => CreditCardDto)
  creditCard?: CreditCardDto;
  
  @ApiPropertyOptional({ type: CreditCardHolderInfoDto }) 
  @IsOptional() 
  @ValidateNested() 
  @Type(() => CreditCardHolderInfoDto)
  creditCardHolderInfo?: CreditCardHolderInfoDto;
  
  @ApiPropertyOptional({ description: 'Token retornado previamente pelo Asaas' })
  @IsOptional() 
  @IsString()
  creditCardToken?: string;
  
  @ApiPropertyOptional({ description: 'IP do cliente (obrigatório p/ cartão)' })
  @IsOptional() 
  @IsString()
  remoteIp?: string;
  
  @ApiPropertyOptional({ description: 'for idempotency' })
  @IsOptional() 
  @IsString()
  idempotencyKey?: string;
}
