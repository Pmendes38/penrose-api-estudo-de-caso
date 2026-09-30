import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { PaymentsRepository } from './repo/payments.repository';
import { AsaasProvider } from './providers/asaas.provider';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    OrdersModule,
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, AsaasProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}