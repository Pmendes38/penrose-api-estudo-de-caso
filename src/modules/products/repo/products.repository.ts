import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, DeleteResult } from 'mongoose';
import { Product, ProductDocument } from '../schemas/product.schema';
import { QueryProductsDto } from '../dto/query-products.dto';

@Injectable()
export class ProductsRepository {
  constructor(@InjectModel(Product.name) private readonly model: Model<ProductDocument>) {}

  private baseProjection = {};

  findById(id: string) {
    return this.model.findOne({ id }, this.baseProjection).lean().exec();
  }

  findBySlug(slug: string) {
    return this.model.findOne({ slug }, this.baseProjection).lean().exec();
  }

  findBySku(sku: string) { 
    return this.model.findOne({ sku }).lean().exec(); 
  }

  async findPublicPaged(q: QueryProductsDto) {
    const filter: FilterQuery<Product> = { status: q.status ?? 'active' };
    if (q.category) filter.category = q.category;
    if (q.minPrice != null || q.maxPrice != null) {
      filter.priceCents = {};
      if (q.minPrice != null) filter.priceCents.$gte = q.minPrice;
      if (q.maxPrice != null) filter.priceCents.$lte = q.maxPrice;
    }
    if (q.search) {
      filter.$text = { $search: q.search };
    }

    const sort: Record<string, 1 | -1> = { [q.sortBy ?? 'createdAt']: (q.sortDir === 'asc' ? 1 : -1) };
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const skip = Math.max(0, (page - 1) * pageSize);

    const [items, total] = await Promise.all([
      this.model.find(filter, this.baseProjection).sort(sort).skip(skip).limit(pageSize).lean().exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async findAdminPaged(page = 1, pageSize = 50) {
    const skip = Math.max(0, (page - 1) * pageSize);
    const [items, total] = await Promise.all([
      this.model.find({}, this.baseProjection).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean().exec(),
      this.model.countDocuments().exec(),
    ]);
    return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  create(doc: Product) {
    return this.model.create(doc);
  }

  updateById(id: string, set: Partial<Product>) {
    return this.model.findOneAndUpdate({ id }, { $set: set }, { new: true }).lean().exec();
  }

  async deleteById(id: string): Promise<DeleteResult> {
    return this.model.deleteOne({ id }).exec();
  }

  // stock helpers
  incStock(id: string, delta: number) {
    return this.model.findOneAndUpdate({ id }, { $inc: { stock: delta } }, { new: true }).lean().exec();
  }

  addImage(id: string, url: string) {
    return this.model.findOneAndUpdate({ id }, { $addToSet: { images: url } }, { new: true }).lean().exec();
  }

  removeImage(id: string, url: string) {
    return this.model.findOneAndUpdate({ id }, { $pull: { images: url } }, { new: true }).lean().exec();
  }

  addTag(id: string, tag: string) {
    return this.model.findOneAndUpdate({ id }, { $addToSet: { tags: tag } }, { new: true }).lean().exec();
  }

  removeTag(id: string, tag: string) {
    return this.model.findOneAndUpdate({ id }, { $pull: { tags: tag } }, { new: true }).lean().exec();
  }
}