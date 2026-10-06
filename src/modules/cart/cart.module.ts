import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cart, CartSchema } from './schemas/cart.schema';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartRepository } from './repo/cart.repository';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { ShippingModule } from '../shipping/shipping.module';
import { CheckoutModule } from '../checkout/checkout.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cart.name, schema: CartSchema }]),
    ShippingModule,
    ProductsModule,
    forwardRef(() => CheckoutModule),
  ],
  controllers: [CartController],
  providers: [CartService, CartRepository, IdempotencyService, IdempotencyInterceptor],
  exports: [CartService, CartRepository],
})
export class CartModule {}
