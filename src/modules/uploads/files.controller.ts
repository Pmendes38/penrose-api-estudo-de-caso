import {
  Controller, Get, Param, Res, NotFoundException, Query, ParseBoolPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';

function guessContentType(filename?: string, fallback = 'application/octet-stream') {
  const n = (filename || '').toLowerCase();
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png'))  return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.avif')) return 'image/avif';
  if (n.endsWith('.gif'))  return 'image/gif';
  if (n.endsWith('.svg'))  return 'image/svg+xml';
  return fallback;
}

@Controller('files')
export class FilesController {
  private bucket: GridFSBucket;

  constructor(@InjectConnection() private readonly conn: Connection) {
    this.bucket = new GridFSBucket(this.conn.db as any, { bucketName: 'uploads' });
  }

  @Get(':id')
  async getFile(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('download', new ParseBoolPipe({ optional: true })) download?: boolean,
  ) {
    let oid: ObjectId;
    try {
      oid = new ObjectId(id);
    } catch {
      throw new NotFoundException('Invalid file id');
    }

    const files = await this.bucket.find({ _id: oid }).toArray();
    if (!files.length) throw new NotFoundException('File not found');

    const file: any = files[0];
    const contentType =
      file?.metadata?.contentType ||
      file?.contentType ||
      guessContentType(file?.filename, 'application/octet-stream');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('ETag', `"${oid.toHexString()}"`);
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${file?.filename || id}"`
    );

    const readStream = this.bucket.openDownloadStream(oid);
    readStream.on('error', () => res.sendStatus(404));
    readStream.pipe(res);
  }
}
