import { Body, Controller, Get, Param, Put, UseGuards, Query, Post, Req, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from './enums/order-status.enum';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Admin
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  @ApiOkResponse({ description: 'Admin order list (paginated).' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  listAdmin(@Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.ordersService.listAdmin(Number(page), Number(pageSize));
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/:id')
  getById(@Param('id') id: string) {
    return this.ordersService.getById(id);
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('admin/:id/status')
  @ApiOkResponse({ description: 'Status updated', schema: { example: { message: 'Status updated successfully', order: {} } } })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto.status);
  }

  // Customer
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @Get('me/:customerId')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  listMyOrders(@Param('customerId') customerId: string, @Query('page') page = 1, @Query('pageSize') pageSize = 20) {
    return this.ordersService.listByCustomer(customerId, Number(page), Number(pageSize));
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @Get('me/order/:id')
  getMyOrder(@Param('id') id: string, @Req() req: any) {
    return this.ordersService.getById(id).then(o => {
      if (!o || o.customerId !== req.user.id) throw new ForbiddenException();
      return o;
    });
  }

  // Fast actions (optional convenience endpoints)
  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('admin/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.ordersService.cancelOrder(id);
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('admin/:id/refund')
  refund(@Param('id') id: string) {
    return this.ordersService.refundOrder(id);
  }
}