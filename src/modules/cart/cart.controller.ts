import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseInterceptors,
  forwardRef,
} from '@nestjs/common';
import type { Response, Request } from 'express';

import { CartService } from './cart.service';
import {
  AddItemDto,
  ApplyCouponDto,
  CreateCartDto,
  ShippingQuoteDto,
  ShippingSelectDto,
  UpdateItemDto,
} from './dto/cart.dto';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { CheckoutService } from '../checkout/checkout.service';

const COOKIE_NAME = 'cartId';

function getExpectedVersion(h: Record<string, string | undefined>) {
  const raw = h['if-match'] ?? (h as any)['If-Match'];
  if (!raw) return null;
  const v = String(raw).replace(/"/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function setNoCache(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Vary', 'Cookie');
}

function setETag(res: Response, version: number) {
  res.setHeader('ETag', `"${version}"`);
}

@Controller('cart')
export class CartController {
  constructor(
    private readonly service: CartService,
    @Inject(forwardRef(() => CheckoutService))
    private readonly checkout: CheckoutService,
  ) {}

  @Post()
  async create(
    @Body() _dto: CreateCartDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id; // opcional
    const cart = await this.service.createCart(userId);

    const cartId = String((cart as any)._id ?? (cart as any).id);
    res.cookie(COOKIE_NAME, cartId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias
    });

    setETag(res, cart.version);
    setNoCache(res);
    return cart;
  }

  @Get()
  async get(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');

    const cart = await this.service.getCart(String(cartId));
    setETag(res, cart.version);
    setNoCache(res);
    return cart;
  }

  @UseInterceptors(IdempotencyInterceptor)
  @Post('items')
  async addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers() headers: Record<string, string>,
    @Body() dto: AddItemDto,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');

    const expected = getExpectedVersion(headers);
    const cart = await this.service.addItem(String(cartId), expected, dto);

    setETag(res, cart.version);
    setNoCache(res);
    return cart;
  }

  @UseInterceptors(IdempotencyInterceptor)
  @Patch('items/:itemId')
  async updateItem(
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers() headers: Record<string, string>,
    @Body() dto: UpdateItemDto,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');

    const expected = getExpectedVersion(headers);
    const cart = await this.service.updateItem(String(cartId), expected, itemId, dto);

    setETag(res, cart.version);
    setNoCache(res);
    return cart;
  }

  @UseInterceptors(IdempotencyInterceptor)
  @Delete('items/:itemId')
  @HttpCode(200)
  async removeItem(
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers() headers: Record<string, string>,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');

    const expected = getExpectedVersion(headers);
    const cart = await this.service.removeItem(String(cartId), expected, itemId);

    setETag(res, cart.version);
    setNoCache(res);
    return cart;
  }

  @UseInterceptors(IdempotencyInterceptor)
  @Post('coupons')
  async applyCoupon(
    @Body() dto: ApplyCouponDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers() headers: Record<string, string>,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');

    const expected = getExpectedVersion(headers);
    const cart = await this.service.applyCoupon(String(cartId), expected, dto.code);

    setETag(res, cart.version);
    setNoCache(res);
    return cart;
  }

  @UseInterceptors(IdempotencyInterceptor)
  @Delete('coupons/:code')
  @HttpCode(200)
  async removeCoupon(
    @Param('code') code: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers() headers: Record<string, string>,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');

    const expected = getExpectedVersion(headers);
    const cart = await this.service.removeCoupon(String(cartId), expected, code);

    setETag(res, cart.version);
    setNoCache(res);
    return cart;
  }

  @Post('shipping/quote')
  async quote(
    @Body() dto: ShippingQuoteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');

    const payload = await this.service.quoteShipping(String(cartId), dto.address);
    setNoCache(res);
    return payload;
  }

  @UseInterceptors(IdempotencyInterceptor)
  @Post('shipping/select')
  async select(
    @Body() dto: ShippingSelectDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Headers() headers: Record<string, string>,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');

    const expected = getExpectedVersion(headers);
    const cart = await this.service.selectShipping(
      String(cartId),
      expected,
      dto
    );

    setETag(res, cart.version);
    setNoCache(res);
    return cart;
  }

  @UseInterceptors(IdempotencyInterceptor)
  @Post('checkout/prepare')
  async legacyPrepare(
    @Req() req: Request,
    @Headers() headers: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cartId = req.cookies?.[COOKIE_NAME];
    if (!cartId) throw new BadRequestException('missing_cart_cookie');

    const expected = getExpectedVersion(headers);
    const idem = (headers['idempotency-key'] as string) ?? (headers as any)['Idempotency-Key'];

    const draft = await this.checkout.prepare(String(cartId), expected, idem);
    const cart = await this.service.getCart(String(cartId));

    setETag(res, cart.version);
    setNoCache(res);
    return { orderDraftId: draft.id, cart };
  }
}
