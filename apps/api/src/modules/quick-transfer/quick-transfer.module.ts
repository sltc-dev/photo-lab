import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule, type MulterModuleOptions } from '@nestjs/platform-express';
import { SecurityModule } from '../../common/security/security.module';
import type { AppEnv } from '../../config/env';
import { PrismaModule } from '../../prisma/prisma.module';
import { PhotosModule } from '../photos/photos.module';
import { QuickTransferController } from './quick-transfer.controller';
import { QuickTransferService } from './quick-transfer.service';

@Module({
  controllers: [QuickTransferController],
  imports: [
    PrismaModule,
    SecurityModule,
    PhotosModule,
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
  providers: [QuickTransferService],
})
export class QuickTransferModule {}
