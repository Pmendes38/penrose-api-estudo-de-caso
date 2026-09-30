// src/modules/products/admin-products.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';

import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UploadsService } from '../uploads/uploads.service';

@ApiTags('Admin Products')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly uploads: UploadsService,
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Admin products (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  listAdmin(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize: number,
  ) {
    return this.products.listAdmin(page, pageSize);
  }

  @Post()
  createAdmin(@Body() dto: CreateProductDto) {
    return this.products.createAdmin(dto);
  }

  @Put(':id')
  updateAdmin(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.updateAdmin(id, dto);
  }

  @Delete(':id')
  deleteAdmin(@Param('id') id: string) {
    return this.products.deleteAdmin(id);
  }

  @Put(':id/stock/increase')
  increaseStock(
    @Param('id') id: string,
    @Query('amount', ParseIntPipe) amount: number,
  ) {
    return this.products.increaseStock(id, amount);
  }

  @Put(':id/stock/decrease')
  decreaseStock(
    @Param('id') id: string,
    @Query('amount', ParseIntPipe) amount: number,
  ) {
    return this.products.decreaseStock(id, amount);
  }

  @Put(':id/images/add')
  addImage(@Param('id') id: string, @Query('url') url: string) {
    return this.products.addImage(id, url);
  }

  @Put(':id/images/remove')
  removeImage(@Param('id') id: string, @Query('url') url: string) {
    return this.products.removeImage(id, url);
  }

  @Put(':id/tags/add')
  addTag(@Param('id') id: string, @Query('tag') tag: string) {
    return this.products.addTag(id, tag);
  }

  @Put(':id/tags/remove')
  removeTag(@Param('id') id: string, @Query('tag') tag: string) {
    return this.products.removeTag(id, tag);
  }

  @Post(':id/images/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadProductImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files?.length) throw new BadRequestException('Envie arquivos no campo "files"');

    const uploaded = await this.uploads.uploadImages(
      files.map((f) => ({ buffer: f.buffer, contentType: f.mimetype })),
      { folder: `products/${id}` },
    );

    for (const u of uploaded) {
      await this.products.addImage(id, u.url);
    }

    return { message: 'Images uploaded', urls: uploaded.map((u) => u.url) };
  }
}
