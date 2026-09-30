import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CheckoutDraft, CheckoutDraftSchema } from './schemas/checkout-draft.schema';
import { CheckoutDraftRepository } from './repo/checkout-draft.repository';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { CartRepository } from '../cart/repo/cart.repository';
import { Cart, CartSchema } from '../cart/schemas/cart.schema';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { HttpModule } from '@nestjs/axios';
import { MelhorEnvioClient } from './providers/melhor-envio.client';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CheckoutDraft.name, schema: CheckoutDraftSchema },
      { name: Cart.name, schema: CartSchema }, // necessário para CartRepository
    ]),
    HttpModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutDraftRepository, CheckoutService, CartRepository, IdempotencyService, IdempotencyInterceptor, MelhorEnvioClient],
  exports: [CheckoutService],
})
export class CheckoutModule {}
