import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../../common/types/authenticated-request';
import type { UploadedPhotoFile } from '../photo-upload.validator';
import { PhotoEditStateDto } from './photo-edit-state.dto';
import { PhotoEditService } from './photo-edit.service';
import { SaveEditedPhotoDto } from './save-edited-photo.dto';

@ApiTags('photos')
@ApiBearerAuth()
@ApiParam({
  description: '图库项目 ID',
  name: 'projectId',
  type: String,
})
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/photos')
export class PhotoEditController {
  constructor(@Inject(PhotoEditService) private readonly photoEditService: PhotoEditService) {}

  @Get(':photoId/edited/state')
  @ApiParam({
    description: '照片 ID',
    name: 'photoId',
    type: String,
  })
  @ApiOkResponse({ type: PhotoEditStateDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  getEditedPhotoState(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('photoId') photoId: string,
  ): Promise<PhotoEditStateDto> {
    return this.photoEditService.getEditedPhotoState(user.id, projectId, photoId);
  }

  @Put(':photoId/edited')
  @ApiParam({
    description: '照片 ID',
    name: 'photoId',
    type: String,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          description: '编辑器导出的图片',
          format: 'binary',
          type: 'string',
        },
        finalize: {
          default: false,
          description: '为 true 时新增一张正式图片并清除编辑草稿',
          type: 'boolean',
        },
        editState: {
          description: '用于恢复文字、水印、裁剪等对象的编辑器状态',
          type: 'string',
        },
      },
    },
  })
  @ApiNoContentResponse({ description: '编辑图片已保存' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.PAYLOAD_TOO_LARGE,
    HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    HttpStatus.INTERNAL_SERVER_ERROR,
  )
  saveEditedPhoto(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('photoId') photoId: string,
    @UploadedFile() file: UploadedPhotoFile | undefined,
    @Body() body: SaveEditedPhotoDto,
  ): Promise<void> {
    return this.photoEditService.saveEditedPhoto(
      user.id,
      projectId,
      photoId,
      file,
      body.finalize,
      body.editState,
    );
  }
}
