import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get('admin')
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOkResponse({ description: 'Admin coupon list', type: [Object] })
  listAdmin() { return this.couponsService.listAdmin(); }

  @Post('admin')
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOkResponse({ description: 'Coupon created', type: Object })
  createAdmin(@Body() dto: CreateCouponDto) { return this.couponsService.createAdmin(dto); }

  @Put('admin/:id')
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOkResponse({ description: 'Coupon updated', type: Object })
  updateAdmin(@Param('id') id: string, @Body() dto: UpdateCouponDto) { return this.couponsService.updateAdmin(id, dto); }

  @Delete('admin/:id')
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOkResponse({ description: 'Coupon removed', type: Object })
  removeAdmin(@Param('id') id: string) { return this.couponsService.removeAdmin(id); }

  @Get('available')
  @ApiOkResponse({ description: 'Available coupons', type: [Object] })
  listAvailable() { return this.couponsService.listAvailable(); }

  @Post('validate')
  @ApiOkResponse({ description: 'Validate coupon and compute discount', type: Object })
  validate(@Body() dto: ValidateCouponDto) {
    return this.couponsService.validate(dto);
  }
}
