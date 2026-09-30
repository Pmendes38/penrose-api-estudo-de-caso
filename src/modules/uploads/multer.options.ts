// src/modules/uploads/multer.options.ts
import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import type { Options } from 'multer';
import { ConfigService } from '@nestjs/config';

export function buildMulterOptions(config: ConfigService): Options {
  const maxMB = config.get<number>('uploads.maxFileSizeMB') ?? 5;
  const allowed = new Set(config.get<string[]>('uploads.allowedMime') ?? []);
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxMB * 1024 * 1024, files: 10 },
    fileFilter: (_req, file, cb) => {
      if (!allowed.has(file.mimetype)) {
        cb(new BadRequestException(`Tipo de arquivo não suportado: ${file.mimetype}`));
      } else {
        cb(null, true);
      }
    },
  };
}
