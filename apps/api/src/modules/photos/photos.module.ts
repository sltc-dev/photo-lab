import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule, type MulterModuleOptions } from '@nestjs/platform-express';
import type { AppEnv } from '../../config/env';
import { SecurityModule } from '../../common/security/security.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { PhotoEditController } from './edit/photo-edit.controller';
import { PhotoEditService } from './edit/photo-edit.service';
import { PhotoMetadataReader } from './photo-metadata.reader';
import { PhotoThumbnailGenerator } from './photo-thumbnail.generator';
import { PhotoUploadValidator } from './photo-upload.validator';
import { PhotosController } from './photos.controller';
import { PhotosService } from './photos.service';

@Module({
  imports: [
    PrismaModule,
    SecurityModule,
    StorageModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnv, true>): MulterModuleOptions => ({
        limits: {
          fileSize: configService.getOrThrow('PHOTO_UPLOAD_MAX_BYTES'),
          files: 1,
        },
      }),
    }),
  ],
  controllers: [PhotosController, PhotoEditController],
  providers: [
    PhotosService,
    PhotoEditService,
    PhotoMetadataReader,
    PhotoThumbnailGenerator,
    PhotoUploadValidator,
  ],
})
export class PhotosModule {}
