import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { ListPaymentsQueryDto } from './dto/list-payments.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOkResponse({ description: 'Create payment (and underlying order)' })
  create(@Body() dto: CreatePaymentDto, @Req() req: any) {
    return this.payments.createDemoCheckout(dto, req.user.id, req.cookies?.cartId);
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  @ApiOkResponse({ description: 'Admin payments list (paginated).' })
  listAdmin(@Query() q: ListPaymentsQueryDto) {
    return this.payments.listAdmin(q.page!, q.pageSize!, {
      status: q.status,
      billingType: q.billingType,
      orderId: q.orderId,
      providerPaymentId: q.providerPaymentId,
    });
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('admin/:id/cancel')
  @ApiOkResponse({ description: 'Payment canceled' })
  cancel(@Param('id') id: string) {
    return this.payments.cancelPayment(id);
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put('admin/:id/refund')
  @ApiOkResponse({ description: 'Payment refunded' })
  refund(@Param('id') id: string) {
    return this.payments.refundPayment(id);
  }

  @ApiBearerAuth('bearer')
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOkResponse({ description: 'Payment by id' })
  getById(@Param('id') id: string, @Req() req: any) {
    return this.payments.getOwnedPayment(id, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/demo/:outcome')
  resolveDemo(@Param('id') id: string, @Param('outcome') outcome: string, @Req() req: any) {
    return this.payments.resolveDemo(id, outcome, req.user.id, req.user.role);
  }

  @Post('webhook')
  @ApiOkResponse({ description: 'Webhook received' })
  webhook(@Req() req: any, @Body() dto: PaymentWebhookDto) {
    return this.payments.handleWebhook(req.rawBody?.toString?.() ?? '', dto as any);
  }
}
