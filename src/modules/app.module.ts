// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { ShippingModule } from './shipping/shipping.module';
import { PaymentsModule } from './payments/payments.module';
import { CouponsModule } from './coupons/coupons.module';
import { OrdersModule } from './orders/orders.module';
import { AdminsModule } from './admins/admins.module';
import { RawBodyMiddleware } from '../common/middleware/raw-body.middleware';
import { UsersModule } from './users/users.module';
import { CartModule } from './cart/cart.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CheckoutModule } from './checkout/checkout.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 60 },
    ]),

    CacheModule.register({
      isGlobal: true,
      ttl: 60,
      max: 500,
    }),

    AdminsModule,
    AuthModule,
    CartModule,
    CheckoutModule,
    CouponsModule,
    HealthModule,
    OrdersModule,
    PaymentsModule,
    ProductsModule,
    ShippingModule,
    UploadsModule,
    UsersModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RawBodyMiddleware).forRoutes('payments/webhook');
  }
}
