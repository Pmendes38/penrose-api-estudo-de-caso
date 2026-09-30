import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import uploadsConfig from '../../config/uploads.config';
import { UploadsService } from './uploads.service';
import { GridFsUploader } from './uploader/gridfs.uploader';
import { UploadsController } from './uploads.controller';
import { FilesController } from './files.controller';
import { buildMulterOptions } from './multer.options';

@Module({
  imports: [
    ConfigModule.forFeature(uploadsConfig),

    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildMulterOptions(config),
    }),
  ],
  providers: [
    UploadsService,
    GridFsUploader,
    { provide: 'Uploader', useExisting: GridFsUploader },
  ],
  controllers: [UploadsController, FilesController],
  exports: [UploadsService],
})
export class UploadsModule {}
