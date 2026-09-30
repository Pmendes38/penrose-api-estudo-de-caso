// src/modules/uploads/uploads.service.ts
import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { UploaderPort, UploadedFileInfo } from './uploader/uploader.port';
// import sharp from 'sharp'; // se quiser redimensionar/otimizar

@Injectable()
export class UploadsService {
  constructor(@Inject('Uploader') private readonly uploader: UploaderPort) {}

  async uploadImages(
    files: Array<{ buffer: Buffer; contentType: string }>,
    opts?: { folder?: string },
  ): Promise<UploadedFileInfo[]> {
    // Aqui daria para:
    // - validar dimensões
    // - converter para webp com sharp
    // - gerar thumbnails
    // Exemplo (opcional):
    // const processed = await Promise.all(files.map(async f => {
    //   const out = await sharp(f.buffer).rotate().toFormat('webp', { quality: 82 }).toBuffer();
    //   return { buffer: out, contentType: 'image/webp' as const };
    // }));
    // return this.uploader.uploadMany(processed, opts);

    return this.uploader.uploadMany(files, opts);
  }
}
