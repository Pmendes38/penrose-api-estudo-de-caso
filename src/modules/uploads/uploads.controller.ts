// src/modules/uploads/uploads.controller.ts
import {
  Controller,
  Post,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';

@ApiTags('Admin Uploads')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) {
      throw new BadRequestException('Envie pelo menos uma imagem (campo "files")');
    }

    const result = await this.uploads.uploadImages(
      files.map((f) => ({ buffer: f.buffer, contentType: f.mimetype })),
      { folder: 'products' },
    );

    return { uploaded: result }; // [{ key, url, contentType, bytes }]
  }
}
