import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import { PhotoDto } from './dto/photo.dto';
import { ListPhotosQueryDto } from './dto/list-photos-query.dto';
import { PhotoPageDto } from './dto/photo-page.dto';
import type { UploadedPhotoFile } from './photo-upload.validator';
import { PhotosService } from './photos.service';

@ApiTags('photos')
@ApiBearerAuth()
@ApiParam({
  description: '图库项目 ID',
  name: 'projectId',
  type: String,
})
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/photos')
export class PhotosController {
  constructor(@Inject(PhotosService) private readonly photosService: PhotosService) {}

  @Get()
  @ApiOkResponse({
    type: PhotoPageDto,
  })
  @ApiQuery({
    description: '上一页返回的游标',
    name: 'cursor',
    required: false,
    type: String,
  })
  @ApiQuery({
    description: '每页照片数量',
    name: 'limit',
    required: false,
    schema: {
      default: 12,
      maximum: 100,
      minimum: 1,
      type: 'integer',
    },
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  listPhotos(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Query() query: ListPhotosQueryDto,
  ): Promise<PhotoPageDto> {
    return this.photosService.listPhotos(user.id, projectId, query);
  }

  @Get(':photoId/thumbnail')
  @ApiParam({
    description: '照片 ID',
    name: 'photoId',
    type: String,
  })
  @ApiProduces('image/webp')
  @ApiOkResponse({
    description: '照片缩略图文件',
    schema: {
      format: 'binary',
      type: 'string',
    },
  })
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  async getThumbnailPhoto(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('photoId') photoId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const photo = await this.photosService.getThumbnailPhoto(user.id, projectId, photoId);

    response.set({
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName)}`,
      'Content-Length': String(photo.sizeBytes),
      'Content-Type': photo.mimeType,
    });

    return new StreamableFile(photo.stream);
  }

  @Get(':photoId/original')
  @ApiParam({
    description: '照片 ID',
    name: 'photoId',
    type: String,
  })
  @ApiProduces('image/jpeg', 'image/png', 'image/webp')
  @ApiOkResponse({
    description: '原始图片文件',
    schema: {
      format: 'binary',
      type: 'string',
    },
  })
  @ApiErrorResponses(
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  async getOriginalPhoto(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('photoId') photoId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const photo = await this.photosService.getOriginalPhoto(user.id, projectId, photoId);

    response.set({
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName)}`,
      'Content-Length': String(photo.sizeBytes),
      'Content-Type': photo.mimeType,
    });

    return new StreamableFile(photo.stream);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          description: '要上传的单张原始图片',
          format: 'binary',
          type: 'string',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: PhotoDto })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.PAYLOAD_TOO_LARGE,
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  uploadPhoto(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @UploadedFile() file: UploadedPhotoFile | undefined,
  ): Promise<PhotoDto> {
    return this.photosService.uploadPhoto(user.id, projectId, file);
  }
}
