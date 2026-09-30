// src/modules/uploads/uploader/gridfs.uploader.ts
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';
import type { UploaderPort, UploadedFileInfo } from './uploader.port';

@Injectable()
export class GridFsUploader implements UploaderPort {
  private bucket: GridFSBucket;
  private publicBaseUrl?: string;

  constructor(
    @InjectConnection() private readonly conn: Connection,
    private readonly config: ConfigService,
  ) {
    this.bucket = new GridFSBucket(this.conn.db as unknown as any, { bucketName: 'uploads' });

    this.publicBaseUrl =
      this.config.get<string>('uploads.publicBaseUrl') ??
      this.config.get<string>('uploads.s3.publicBaseUrl'); // compat
  }

  async uploadMany(
    files: Array<{ buffer: Buffer; contentType: string; suggestedExt?: string }>,
    opts?: { folder?: string },
  ): Promise<UploadedFileInfo[]> {
    const folder = (opts?.folder || 'products').replace(/^\//, '').replace(/\/$/, '');
    const results: UploadedFileInfo[] = [];

    for (const f of files) {
      const ext = this.extFromMime(f.contentType);
      const filename = `${folder}/${new ObjectId().toHexString()}.${ext}`;

      const stream = Readable.from(f.buffer);
      const uploadStream = this.bucket.openUploadStream(filename, {
        metadata: { folder, contentType: f.contentType },
      });

      await new Promise<void>((resolve, reject) => {
        stream.pipe(uploadStream).once('finish', () => resolve()).once('error', reject);
      });

      const id = uploadStream.id as ObjectId;
      const key = id.toHexString();

      const url = this.publicBaseUrl
        ? `${this.publicBaseUrl.replace(/\/$/, '')}/api/v1/files/${key}`
        : `/api/v1/files/${key}`;

      results.push({
        key,
        url,
        contentType: f.contentType,
        bytes: f.buffer.byteLength,
      });
    }

    return results;
  }

  private extFromMime(mime: string) {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
    };
    return map[mime] || 'bin';
  }
}
