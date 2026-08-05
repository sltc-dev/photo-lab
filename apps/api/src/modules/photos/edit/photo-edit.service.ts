import { createHash, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { PhotoStatus, Prisma } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { PhotoMetadataReader } from '../photo-metadata.reader';
import { removeStoredObjects } from '../photo-storage-cleanup.util';
import { buildOriginalObjectKey, getFileNameBase } from '../photo-storage-key.util';
import { PhotoUploadValidator, type UploadedPhotoFile } from '../photo-upload.validator';
import type { PhotoEditStateDto } from './photo-edit-state.dto';

const photoEditSelect = {
  id: true,
  fileName: true,
  editState: true,
  previewObjectKey: true,
} satisfies Prisma.PhotoSelect;

@Injectable()
export class PhotoEditService {
  private readonly logger = new Logger(PhotoEditService.name);

  /** 注入数据库、文件存储、上传校验和图片元数据读取能力。 */
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(StorageService)
    private readonly storageService: StorageService,
    @Inject(PhotoUploadValidator)
    private readonly uploadValidator: PhotoUploadValidator,
    @Inject(PhotoMetadataReader)
    private readonly metadataReader: PhotoMetadataReader,
  ) {}

  /**
   * 返回用于恢复裁剪、文字和水印等内容的结构化编辑状态；未保存时返回 null。
   */
  async getEditedPhotoState(
    userId: string,
    projectId: string,
    photoId: string,
  ): Promise<PhotoEditStateDto> {
    const photo = await this.findOwnedPhoto(userId, projectId, photoId);

    if (!photo) {
      throw new AppException(HttpStatus.NOT_FOUND, 'PHOTO_NOT_FOUND', '照片不存在');
    }

    return {
      editState: asEditState(photo.editState),
    };
  }

  /**
   * 保存编辑器导出的图片和状态；finalize 为 false 时更新草稿，为 true 时创建新照片。
   */
  async saveEditedPhoto(
    userId: string,
    projectId: string,
    photoId: string,
    file: UploadedPhotoFile | undefined,
    finalize: boolean,
    editState?: string,
  ): Promise<void> {
    const photo = await this.findOwnedPhoto(userId, projectId, photoId);

    if (!photo) {
      throw new AppException(HttpStatus.NOT_FOUND, 'PHOTO_NOT_FOUND', '照片不存在');
    }

    const validated = await this.uploadValidator.validate(file);
    const metadata = await this.metadataReader.readMetadata(file!.buffer);
    const checksumSha256 = createHash('sha256').update(file!.buffer).digest('hex');
    const parsedEditState = parseEditState(editState);

    const finalizedPhoto = finalize
      ? {
          fileName: `${getFileNameBase(photo.fileName)}.edited.${validated.extension}`,
          id: randomUUID(),
        }
      : null;
    const objectKey = finalizedPhoto
      ? buildOriginalObjectKey(projectId, finalizedPhoto.id, finalizedPhoto.fileName)
      : buildEditedObjectKey(projectId, photoId, validated.extension);

    // 数据库只保存对象键；图片二进制内容先写入文件存储。
    try {
      await this.storageService.putObject(objectKey, file!.buffer);
    } catch {
      await this.removeObjects([objectKey]);
      throw new AppException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'PHOTO_STORAGE_FAILED',
        '编辑图片保存失败',
      );
    }

    try {
      if (finalizedPhoto) {
        // 完成编辑：创建正式照片，同时清空原照片上的草稿引用和编辑状态。
        await this.prisma.$transaction([
          this.prisma.photo.create({
            data: {
              checksumSha256,
              fileName: finalizedPhoto.fileName,
              height: metadata.height,
              id: finalizedPhoto.id,
              mimeType: validated.mimeType,
              originalObjectKey: objectKey,
              projectId,
              relativePath: finalizedPhoto.fileName,
              sizeBytes: validated.sizeBytes,
              status: PhotoStatus.UPLOADED,
              width: metadata.width,
            },
          }),
          this.prisma.photo.update({
            data: {
              previewObjectKey: null,
              editState: Prisma.DbNull,
            },
            where: {
              id: photo.id,
            },
          }),
        ]);
      } else {
        // 保存草稿：原照片保持不变，只更新预览图位置和结构化编辑状态。
        await this.prisma.photo.update({
          data: {
            editState: parsedEditState ?? Prisma.DbNull,
            previewObjectKey: objectKey,
          },
          where: {
            id: photo.id,
          },
        });
      }
    } catch (error) {
      await this.removeObjects([objectKey]);
      throw error;
    }

    if (photo.previewObjectKey) {
      await this.removeObjects([photo.previewObjectKey]);
    }
  }

  /**
   * 按用户、图库和照片三层条件查询照片，确保调用者只能操作自己图库中的照片。
   */
  private findOwnedPhoto(userId: string, projectId: string, photoId: string) {
    return this.prisma.photo.findFirst({
      select: photoEditSelect,
      where: {
        id: photoId,
        project: {
          userId,
        },
        projectId,
      },
    });
  }

  /** 清理不再使用的存储对象，并统一记录清理失败日志。 */
  private removeObjects(objectKeys: string[]): Promise<void> {
    return removeStoredObjects(this.storageService, objectKeys, this.logger);
  }
}

/** 为编辑草稿生成不会与历史草稿冲突的对象存储键。 */
function buildEditedObjectKey(
  projectId: string,
  photoId: string,
  extension: 'jpg' | 'png' | 'webp',
): string {
  return `projects/${projectId}/photos/${photoId}/edited/${randomUUID()}.${extension}`;
}

/** 将表单中的 JSON 字符串解析为 Prisma 可写入的对象，拒绝数组和基本类型。 */
function parseEditState(value: string | undefined): Prisma.InputJsonObject | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Edit state must be an object');
    }

    return parsed as Prisma.InputJsonObject;
  } catch {
    throw new AppException(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', '编辑草稿状态格式无效');
  }
}

/** 将数据库 JSON 值收窄为前端可使用的编辑状态对象。 */
function asEditState(value: Prisma.JsonValue): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
