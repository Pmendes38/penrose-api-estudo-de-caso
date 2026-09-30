import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { MelhorEnvioProvider } from './providers/melhor-envio.provider';

@Module({
  imports: [ConfigModule, HttpModule],
  controllers: [ShippingController],
  providers: [ShippingService, MelhorEnvioProvider],
  exports: [ShippingService],
})
export class ShippingModule {}