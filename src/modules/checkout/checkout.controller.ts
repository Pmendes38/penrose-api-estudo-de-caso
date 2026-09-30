import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
  import type { Request, Response } from 'express';
import { CheckoutService } from './checkout.service';
import { GetDraftParamDto } from './dto/get-draft.dto';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { PlaceOrderDto } from './dto/place-order.dto';

const COOKIE_NAME = 'cartId';

function getExpectedVersion(h: Record<string, string | undefined>) {
  const tag = (h['if-match'] as string) || (h['If-Match'] as any);
  if (!tag) return null;
  const v = String(tag).replace(/"/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @UseInterceptors(IdempotencyInterceptor)
  @Post('prepare')
  async prepare(
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');

    const expected = getExpectedVersion(headers);
    const idem = headers['idempotency-key'] || headers['Idempotency-Key'] || undefined;

    const draft = await this.checkout.prepare(String(cartId), expected, idem);
    res.setHeader('Cache-Control', 'no-store');
    return { draftId: draft.id, draft };
  }

  @Get('drafts/:id')
  async getDraft(
    @Param() params: GetDraftParamDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');
    const draft = await this.checkout.getDraftForCart(String(cartId), params.id);
    res.setHeader('Cache-Control', 'no-store');
    return draft;
  }

  @UseInterceptors(IdempotencyInterceptor)
  @Post('place')
  async place(
    @Body() dto: PlaceOrderDto,
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');
    const idem = headers['idempotency-key'] || headers['Idempotency-Key'] || undefined;

    const result = await this.checkout.place(String(cartId), dto.draftId, dto.printMode || 'private', idem);
    return result;
  }

  @Delete('drafts')
  @HttpCode(204)
  async abandonAll(@Req() req: Request) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');
    await this.checkout.abandonAllForCart(String(cartId));
  }
}
