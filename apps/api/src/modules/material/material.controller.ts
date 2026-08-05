import { Controller, Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MaterialUserService } from './material-users.service';
import { MaterialUserDto } from './dto/material-user.dto';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { MaterialPhotosService } from './material-photos.service';
import { ListMaterialPhotosQueryDto, MaterialPhotoPageDto } from './dto/material-photo.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequestUser } from '../../common/types/authenticated-request';
import { ProjectDto } from '../projects/dto/project.dto';

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
  ) {}

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
}
