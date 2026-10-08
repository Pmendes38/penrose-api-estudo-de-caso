import {
  Injectable, BadRequestException, ConflictException, InternalServerErrorException, NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CouponsRepository } from './repo/coupons.repository';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponType } from './enums/coupon-type.enum';
import * as crypto from 'crypto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly repo: CouponsRepository) {}

  async listAdmin() {
    return this.repo.listAdmin();
  }

  private validateBusinessRules(dto: { type: CouponType; value: number; startsAt: string; endsAt: string; minimumOrderValue?: number }) {
    const starts = new Date(dto.startsAt);
    const ends = new Date(dto.endsAt);
    if (Number.isNaN(+starts) || Number.isNaN(+ends)) {
      throw new BadRequestException('Invalid dates (startsAt/endsAt)');
    }
    if (starts >= ends) {
      throw new BadRequestException('startsAt must be before endsAt');
    }

    if (dto.type === CouponType.PERCENT) {
      if (dto.value <= 0 || dto.value > 100) {
        throw new BadRequestException('Percent coupon value must be between 0 and 100');
      }
    } else if (dto.type === CouponType.FIXED) {
      if (dto.value <= 0) throw new BadRequestException('Fixed coupon value must be greater than 0');
    }

    if (dto.minimumOrderValue !== undefined && dto.minimumOrderValue < 0) {
      throw new BadRequestException('minimumOrderValue must be >= 0');
    }
  }

  async createAdmin(dto: CreateCouponDto) {
    this.validateBusinessRules(dto);

    // code unique
    const existing = await this.repo.findByCode(dto.code);
    if (existing) throw new ConflictException('Coupon code already exists');

    const doc = {
      id: crypto.randomUUID(),
      code: dto.code,
      description: dto.description,
      type: dto.type,
      value: dto.value,
      minimumOrderValue: dto.minimumOrderValue ?? 0,
      maxRedemptions: dto.maxRedemptions ?? null,
      currentRedemptions: 0,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      productIds: dto.productIds ?? [],
      sizes: dto.sizes ?? [],
      active: dto.active ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const created = await this.repo.create(doc);
      return created.toJSON();
    } catch (e) {
      throw new InternalServerErrorException('Failed to create coupon');
    }
  }

  async updateAdmin(id: string, dto: UpdateCouponDto) {
    const current = await this.repo.updateById(id, {} as any);
    if (!current) throw new NotFoundException('Coupon not found');

    const toDate = (v?: string | Date | null) =>
      v == null ? undefined : (v instanceof Date ? v : new Date(v));

    const nextType = dto.type ?? current.type;
    const nextValue = dto.value ?? current.value;

    if (nextType === CouponType.PERCENT) {
      if (nextValue < 0 || nextValue > 100) {
        throw new BadRequestException('Percent coupon value must be between 0 and 100');
      }
    }

    const set: any = {
      description: dto.description ?? current.description,
      type: nextType,
      value: nextValue,
      startsAt: toDate(dto.startsAt) ?? toDate(current.startsAt),
      endsAt: toDate(dto.endsAt) ?? toDate(current.endsAt),
      minimumOrderValue:
        dto.minimumOrderValue ?? (current.minimumOrderValue === null ? undefined : current.minimumOrderValue),
      productIds: dto.productIds ?? current.productIds,
      sizes: dto.sizes ?? current.sizes,
      active: dto.active ?? current.active,
      updatedAt: new Date(),
    };

    const updated = await this.repo.updateById(id, set);
    if (!updated) throw new NotFoundException('Coupon not found');
    return updated;
  }

  async removeAdmin(id: string) {
    const res = await this.repo.deleteById(id);
    if (!('deletedCount' in res) || res.deletedCount === 0) {
      throw new NotFoundException('Coupon not found');
    }
    return { message: 'Coupon deleted successfully' };
  }

  async listAvailable() {
    const nowISO = new Date().toISOString();
    try {
      return await this.repo.listAvailable(nowISO);
    } catch {
      throw new InternalServerErrorException('Failed to fetch available coupons');
    }
  }

  async validate(dto: ValidateCouponDto) {
    const code = dto.code?.trim().toUpperCase();
    if (!code) throw new BadRequestException('code é obrigatório');

    const coupon = await this.repo.findByCode(code);
    if (!coupon) throw new NotFoundException('Cupom não encontrado');

    const now = new Date();
    if (!coupon.active) throw new ForbiddenException('Cupom inativo');
    if (coupon.startsAt && new Date(coupon.startsAt) > now) {
      throw new ForbiddenException('Cupom ainda não está válido');
    }
    if (coupon.endsAt && new Date(coupon.endsAt) < now) {
      throw new ForbiddenException('Cupom expirado');
    }
    if (coupon.maxRedemptions != null && coupon.currentRedemptions >= coupon.maxRedemptions) {
      throw new ForbiddenException('Limite de usos atingido');
    }

    const cartTotal = Number(dto.cartTotal ?? 0);
    if (coupon.minimumOrderValue && cartTotal < coupon.minimumOrderValue) {
      throw new ForbiddenException(`Valor mínimo para uso: R$ ${coupon.minimumOrderValue.toFixed(2)}`);
    }

    if (Array.isArray(coupon.productIds) && coupon.productIds.length) {
      const itemProductIds = new Set((dto.items ?? []).map(i => i.productId));
      const intersects = coupon.productIds.some((pid: string) => itemProductIds.has(pid));
      if (!intersects) throw new ForbiddenException('Cupom não aplicável aos itens do carrinho');
    }
    if (Array.isArray(coupon.sizes) && coupon.sizes.length) {
      const itemSizes = new Set((dto.items ?? []).map(i => i.size).filter(Boolean));
      const intersects = coupon.sizes.some((s: string) => itemSizes.has(s));
      if (!intersects) throw new ForbiddenException('Cupom não aplicável ao tamanho selecionado');
    }

    let discount = 0;
    if (coupon.type === 'PERCENT') {
      discount = (cartTotal * Number(coupon.value)) / 100;
    } else if (coupon.type === 'FIXED') {
      discount = Number(coupon.value);
    }
    discount = Math.max(0, Math.min(discount, cartTotal));

    return {
      ok: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        minimumOrderValue: coupon.minimumOrderValue ?? 0,
        startsAt: coupon.startsAt,
        endsAt: coupon.endsAt,
      },
      discountTotal: Number(discount.toFixed(2)),
    };
  }

  async applyRedemption(couponId: string) {
    const updated = await this.repo.incRedemptions(couponId, 1);
    if (!updated) throw new NotFoundException('Cupom não encontrado para aplicar resgate');
    return updated;
  }

  async cartDiscount(cart: { coupons?: string[]; items: any[]; itemsSubtotal: number }) {
    if (!cart.coupons?.length) return 0;
    if (cart.coupons.length > 1) throw new BadRequestException('Use apenas um cupom por pedido.');
    const result = await this.validate({ code: cart.coupons[0], cartTotal: cart.itemsSubtotal / 100,
      items: cart.items.map(item => ({ productId: item.productId, size: item.variant?.size, quantity: item.quantity, unitPrice: item.unitPrice / 100 })) });
    return Math.round(result.discountTotal * 100);
  }
}
