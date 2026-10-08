import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ProductsRepository } from './repo/products.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { ProductStatus } from './enums/product-status.enum';
import catalog from './catalog-data.json';

export const sizePricesCents: Record<string, number> = { '20cm': 160000, '30cm': 180000, '40cm': 320000 };

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function normalizeSku(raw?: string | null) {
  const s = (raw ?? '').trim();
  if (!s) return undefined;
  return s.replace(/[^A-Za-z0-9\-_.]/g, '').toUpperCase();
}

@Injectable()
export class ProductsService implements OnModuleInit {
  constructor(private readonly repo: ProductsRepository) {}

  async onModuleInit() {
    // ponytail: bundled catalog is the bootstrap source; archive by status, not delete, or it returns on restart.
    for (const product of catalog) {
      const existing = await this.repo.findBySku(product.sku);
      if (existing) {
        if (existing.madeToOrder && existing.pricingVersion !== 2) await this.repo.updateById(existing.id, { priceCents: sizePricesCents['20cm'], pricingVersion: 2 });
        continue;
      }
      await this.repo.create({ id: product.id, sku: product.sku, name: product.name, slug: slugify(product.name), category: product.category, description: product.description, images: product.images, tags: product.tags, priceCents: sizePricesCents['20cm'], pricingVersion: 2, stock: 0, madeToOrder: true, status: ProductStatus.ACTIVE } as any);
    }
  }

  listPublic(query: QueryProductsDto) {
    return this.repo.findPublicPaged(query);
  }

  async getPurchasableBySku(sku: string) {
    const product = await this.repo.findBySku(sku.trim().toUpperCase());
    if (!product || product.status !== ProductStatus.ACTIVE) throw new NotFoundException('product_unavailable');
    if (!Number.isSafeInteger(product.priceCents) || product.priceCents <= 0) throw new BadRequestException('product_price_unavailable');
    return product;
  }

  priceForVariant(product: { priceCents: number; madeToOrder?: boolean }, variant?: Record<string, string>) {
    if (!product.madeToOrder) return product.priceCents;
    // ponytail: one price ladder covers every custom piece; store per-product ladders if they diverge.
    const size = variant?.size ?? '20cm';
    const price = sizePricesCents[size];
    if (!price) throw new BadRequestException('invalid_size');
    return price;
  }

  async findPublicByIdOrSlug(idOrSlug: string) {
    if (!idOrSlug?.trim()) throw new BadRequestException('Product id/slug is required');

    const byId = await this.repo.findById(idOrSlug);
    if (byId && byId.status === ProductStatus.ACTIVE) {
      return { success: true, source: 'mongo', product: byId };
    }

    const bySlug = await this.repo.findBySlug(idOrSlug.toLowerCase());
    if (bySlug && bySlug.status === ProductStatus.ACTIVE) {
      return { success: true, source: 'mongo', product: bySlug };
    }

    throw new NotFoundException('Product not found');
  }

  listAdmin(page = 1, pageSize = 50) {
    return this.repo.findAdminPaged(page, pageSize);
  }

  async findAdminById(id: string) {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async uniqueSlugFromName(name: string, excludeId?: string) {
    const base = slugify(name) || 'produto';
    let candidate = base;
    let i = 1;

    while (true) {
      const found = await this.repo.findBySlug(candidate);
      if (!found || (excludeId && found.id === excludeId)) break;
      i += 1;
      candidate = `${base}-${i}`;
    }
    return candidate;
  }

  private async uniqueSku(
    proposed: string | undefined,
    nameForFallback: string,
    excludeId?: string,
  ) {
    let base = normalizeSku(proposed);
    if (!base) {
      base = normalizeSku(slugify(nameForFallback).replace(/-/g, '').slice(0, 12)) || 'SKU';
    }

    let candidate = base;
    let i = 1;

    while (true) {
      const found = await this.repo.findBySku(candidate);
      if (!found || (excludeId && found.id === excludeId)) break;
      i += 1;
      candidate = `${base}-${String(i).padStart(2, '0')}`;
    }

    return candidate;
  }

  async createAdmin(dto: CreateProductDto) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Name is required');
    if (dto.priceCents == null || dto.priceCents < 0) {
      throw new BadRequestException('Price is required');
    }

    const now = new Date();

    const slug = await this.uniqueSlugFromName(name);
    const sku = await this.uniqueSku(dto.sku, name);

    const doc = {
      id: crypto.randomUUID(),
      name,
      slug,
      category: dto.category?.trim(),
      priceCents: dto.priceCents,
      stock: dto.stock ?? 0,
      madeToOrder: dto.madeToOrder ?? false,
      status: dto.status ?? ProductStatus.ACTIVE,
      description: dto.description,
      images: (dto.images ?? []).map((u) => String(u).trim()).filter(Boolean),
      tags: (dto.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
      sku,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const created = await this.repo.create(doc as any);
      return { message: 'Product created', product: created.toJSON() };
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Slug/SKU already in use');
      throw new InternalServerErrorException('Failed to create product');
    }
  }

  async updateAdmin(id: string, dto: UpdateProductDto) {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundException('Product not found');

    const set: any = { updatedAt: new Date() };

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      set.name = name;
      set.slug = await this.uniqueSlugFromName(name, id);
    }

    if (dto.category !== undefined) set.category = dto.category?.trim();

    if (dto.priceCents !== undefined) set.priceCents = dto.priceCents;
    if (dto.stock !== undefined) set.stock = dto.stock;
    if (dto.madeToOrder !== undefined) set.madeToOrder = dto.madeToOrder;

    if (dto.status !== undefined) set.status = dto.status;
    if (dto.description !== undefined) set.description = dto.description;

    if (dto.images !== undefined) {
      set.images = dto.images.map((u) => String(u).trim()).filter(Boolean);
    }
    if (dto.tags !== undefined) {
      set.tags = dto.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
    }

    if (dto.sku !== undefined) {
      const nameForFallback = dto.name?.trim() ?? current.name;
      set.sku = await this.uniqueSku(dto.sku, nameForFallback, id);
    }

    try {
      const updated = await this.repo.updateById(id, set);
      if (!updated) throw new NotFoundException('Product not found');
      return { message: 'Product updated', product: updated };
    } catch (e: any) {
      if (e instanceof NotFoundException) throw e;
      if (e?.code === 11000) throw new ConflictException('Slug/SKU already in use');
      throw new InternalServerErrorException('Failed to update product');
    }
  }

  async deleteAdmin(id: string) {
    const res = await this.repo.deleteById(id);
    if (!('deletedCount' in res) || res.deletedCount === 0) {
      throw new NotFoundException('Product not found');
    }
    return { message: 'Product deleted' };
  }

  async increaseStock(id: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    const updated = await this.repo.incStock(id, amount);
    if (!updated) throw new NotFoundException('Product not found');
    return updated;
  }

  async decreaseStock(id: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');
    const updated = await this.repo.incStock(id, -amount);
    if (!updated) throw new NotFoundException('Product not found');
    if ((updated.stock ?? 0) < 0) {
      await this.repo.incStock(id, amount);
      throw new BadRequestException('Stock cannot be negative');
    }
    return updated;
  }

  addImage(id: string, url: string) {
    const clean = url?.trim();
    if (!clean) throw new BadRequestException('Image URL required');
    return this.repo.addImage(id, clean);
  }

  removeImage(id: string, url: string) {
    const clean = url?.trim();
    if (!clean) throw new BadRequestException('Image URL required');
    return this.repo.removeImage(id, clean);
  }

  addTag(id: string, tag: string) {
    const clean = tag?.trim().toLowerCase();
    if (!clean) throw new BadRequestException('Tag required');
    return this.repo.addTag(id, clean);
  }

  removeTag(id: string, tag: string) {
    const clean = tag?.trim().toLowerCase();
    if (!clean) throw new BadRequestException('Tag required');
    return this.repo.removeTag(id, clean);
  }
}
