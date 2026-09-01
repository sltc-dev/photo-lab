import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PhotoKind } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MaterialUserService } from './material-users.service';
import { MaterialUserDto } from './dto/material-user.dto';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { MaterialPhotosService } from './material-photos.service';
import {
  ListMaterialPhotosQueryDto,
  MaterialPhotoFavoriteStateDto,
  MaterialPhotoLikeStateDto,
  MaterialPhotoPageDto,
} from './dto/material-photo.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { ProjectDto } from '../projects/dto/project.dto';
import { CreateMaterialCommentDto, MaterialCommentDto } from './dto/material-comment.dto';
import { MaterialStickerDto } from './dto/material-sticker.dto';
import { MaterialStickersService } from './material-stickers.service';
import type { UploadedPhotoFile } from '../photos/photo-upload.validator';

//swagger装饰器，影响接口文档
@ApiTags('material')
@ApiBearerAuth()
//jwt身份验证
@UseGuards(JwtAuthGuard)
//声明这个类是一个 Controller。设置该 Controller 下所有接口的路由前缀。
@Controller('material')
export class MaterialController {
  constructor(
    private readonly materialUserService: MaterialUserService,
    private readonly materialPhotosService: MaterialPhotosService,
    private readonly materialStickersService: MaterialStickersService,
  ) {}

  @Get('stickers')
  @ApiOkResponse({ isArray: true, type: MaterialStickerDto })
  listStickers(@CurrentUser() currentUser: RequestUser): Promise<MaterialStickerDto[]> {
    return this.materialStickersService.list(currentUser.id);
  }

  @Post('stickers')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: MaterialStickerDto })
  uploadSticker(
    @CurrentUser() currentUser: RequestUser,
    @UploadedFile() file?: UploadedPhotoFile,
  ): Promise<MaterialStickerDto> {
    return this.materialStickersService.upload(currentUser.id, file);
  }

  @Delete('stickers/:stickerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'stickerId', type: String })
  deleteSticker(
    @CurrentUser() currentUser: RequestUser,
    @Param('stickerId') stickerId: string,
  ): Promise<void> {
    return this.materialStickersService.remove(currentUser.id, stickerId);
  }

  @Get('users')
  @ApiOkResponse({
    description: '返回所有用户及每个用户用有的图库数量',
    isArray: true,
    type: MaterialUserDto,
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  listUsers(@CurrentUser() currentUser: RequestUser): Promise<MaterialUserDto[]> {
    return this.materialUserService.listUsers(currentUser.id);
  }

  @Get('users/:userId/projects')
  @ApiParam({
    description: '用户 ID',
    name: 'userId',
    type: String,
  })
  @ApiOkResponse({
    isArray: true,
    type: ProjectDto,
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  listUserProjects(
    @CurrentUser() currentUser: RequestUser,
    @Param('userId') userId: string,
  ): Promise<ProjectDto[]> {
    return this.materialPhotosService.listUserProjects(userId, currentUser.id);
  }

  @Get('projects/:projectId/photos')
  @ApiParam({
    description: '图库项目 ID',
    name: 'projectId',
    type: String,
  })
  @ApiOkResponse({
    type: MaterialPhotoPageDto,
  })
  @ApiQuery({
    description: '上一页返回的图片游标',
    name: 'cursor',
    required: false,
    type: String,
  })
  @ApiQuery({
    description: '照片类型；不传时返回全部照片',
    enum: PhotoKind,
    enumName: 'PhotoKind',
    name: 'kind',
    required: false,
  })
  @ApiQuery({
    description: '每页返回的图片数量',
    name: 'limit',
    required: false,
    schema: {
      default: 24,
      maximum: 100,
      minimum: 1,
      type: 'integer',
    },
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  listProjectPhotos(
    @CurrentUser() currentUser: RequestUser,
    @Param('projectId') projectId: string,
    @Query() query: ListMaterialPhotosQueryDto,
  ): Promise<MaterialPhotoPageDto> {
    return this.materialPhotosService.listProjectPhotos(projectId, query, currentUser.id);
  }

  @Get('favorites')
  @ApiOkResponse({ type: MaterialPhotoPageDto })
  @ApiQuery({
    description: '上一页返回的图片游标',
    name: 'cursor',
    required: false,
    type: String,
  })
  @ApiQuery({
    description: '照片类型；不传时返回全部照片',
    enum: PhotoKind,
    enumName: 'PhotoKind',
    name: 'kind',
    required: false,
  })
  @ApiQuery({
    description: '每页返回的图片数量',
    name: 'limit',
    required: false,
    schema: { default: 24, maximum: 100, minimum: 1, type: 'integer' },
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  listFavoritePhotos(
    @CurrentUser() currentUser: RequestUser,
    @Query() query: ListMaterialPhotosQueryDto,
  ): Promise<MaterialPhotoPageDto> {
    return this.materialPhotosService.listFavoritePhotos(query, currentUser.id);
  }

  @Put('photos/:photoId/like')
  @ApiParam({ name: 'photoId', type: String })
  @ApiOkResponse({ type: MaterialPhotoLikeStateDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  likeMaterialPhoto(
    @CurrentUser() currentUser: RequestUser,
    @Param('photoId') photoId: string,
  ): Promise<MaterialPhotoLikeStateDto> {
    return this.materialPhotosService.likePhoto(photoId, currentUser.id);
  }

  @Delete('photos/:photoId/like')
  @ApiParam({ name: 'photoId', type: String })
  @ApiOkResponse({ type: MaterialPhotoLikeStateDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  unlikeMaterialPhoto(
    @CurrentUser() currentUser: RequestUser,
    @Param('photoId') photoId: string,
  ): Promise<MaterialPhotoLikeStateDto> {
    return this.materialPhotosService.unlikePhoto(photoId, currentUser.id);
  }

  @Put('photos/:photoId/favorite')
  @ApiParam({ name: 'photoId', type: String })
  @ApiOkResponse({ type: MaterialPhotoFavoriteStateDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  favoriteMaterialPhoto(
    @CurrentUser() currentUser: RequestUser,
    @Param('photoId') photoId: string,
  ): Promise<MaterialPhotoFavoriteStateDto> {
    return this.materialPhotosService.favoritePhoto(photoId, currentUser.id);
  }

  @Delete('photos/:photoId/favorite')
  @ApiParam({ name: 'photoId', type: String })
  @ApiOkResponse({ type: MaterialPhotoFavoriteStateDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  unfavoriteMaterialPhoto(
    @CurrentUser() currentUser: RequestUser,
    @Param('photoId') photoId: string,
  ): Promise<MaterialPhotoFavoriteStateDto> {
    return this.materialPhotosService.unfavoritePhoto(photoId, currentUser.id);
  }

  @Get('photos/:photoId/comments')
  @ApiParam({ name: 'photoId', type: String })
  @ApiOkResponse({ isArray: true, type: MaterialCommentDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  listMaterialPhotoComments(
    @CurrentUser() currentUser: RequestUser,
    @Param('photoId') photoId: string,
  ): Promise<MaterialCommentDto[]> {
    return this.materialPhotosService.listComments(photoId, currentUser.id);
  }

  @Post('photos/:photoId/comments')
  @ApiParam({ name: 'photoId', type: String })
  @ApiBody({ type: CreateMaterialCommentDto })
  @ApiOkResponse({ type: MaterialCommentDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  createMaterialPhotoComment(
    @CurrentUser() currentUser: RequestUser,
    @Param('photoId') photoId: string,
    @Body() dto: CreateMaterialCommentDto,
  ): Promise<MaterialCommentDto> {
    return this.materialPhotosService.createComment(photoId, currentUser.id, dto);
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'commentId', type: String })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  deleteMaterialPhotoComment(
    @CurrentUser() currentUser: RequestUser,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    return this.materialPhotosService.deleteComment(commentId, currentUser.id);
  }
}
