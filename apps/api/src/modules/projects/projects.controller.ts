import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectDto } from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: CreateProjectDto })
  @ApiCreatedResponse({ type: ProjectDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  createProject(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectDto> {
    return this.projectsService.createProject(user.id, dto);
  }

  @Get()
  @ApiOkResponse({
    isArray: true,
    type: ProjectDto,
  })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  listProjects(@CurrentUser() user: RequestUser): Promise<ProjectDto[]> {
    return this.projectsService.listProjects(user.id);
  }

  @Get(':projectId')
  @ApiParam({
    description: '图库项目 ID',
    name: 'projectId',
    type: String,
  })
  @ApiOkResponse({ type: ProjectDto })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  getProject(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ): Promise<ProjectDto> {
    return this.projectsService.getProject(user.id, projectId);
  }
}
