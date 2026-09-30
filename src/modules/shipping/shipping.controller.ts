import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';
import { ValidateCepDto } from './dto/validate-cep.dto';

@ApiTags('Shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Shipping quotes for the given destination and package' })
  calculate(@Body() dto: CalculateShippingDto) {
    return this.shipping.quote(dto);
  }

  @Post('validate-postal-code')
  @HttpCode(HttpStatus.OK)
  validatePostalCode(@Body() dto: ValidateCepDto) {
    return this.shipping.validatePostalCode(dto.postalCode);
  }

  @Get('services')
  @ApiOkResponse({ description: 'List available carriers/services' })
  listServices() {
    return this.shipping.listAvailableServices();
  }

  @Post('track')
  @HttpCode(HttpStatus.OK)
  track(@Body('trackingCode') trackingOrOrderId: string) {
    return this.shipping.trackShipment(trackingOrOrderId);
  }

  @Get('demo/calculate')
  @ApiQuery({ name: 'postalCode', required: true })
  demo(@Query('postalCode') postalCode: string) {
    const dto: CalculateShippingDto = {
      destination: { postalCode },
      packages: [{ weightKg: 1, widthCm: 20, heightCm: 10, lengthCm: 20, declaredValue: 100 }],
    } as any;
    return this.shipping.quote(dto);
  }
}
