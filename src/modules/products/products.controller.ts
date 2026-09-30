// src/modules/products/products.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { QueryProductsDto } from './dto/query-products.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOkResponse({ description: 'Public products (paginated with filters)' })
  list(@Query() query: QueryProductsDto) {
    return this.products.listPublic(query);
  }

  @Get(':idOrSlug')
  @ApiOkResponse({ description: 'Public product by id or slug' })
  getPublic(@Param('idOrSlug') idOrSlug: string) {
    return this.products.findPublicByIdOrSlug(idOrSlug);
  }
}
