import {
  Controller,
  Get,
  Header,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import type { UploadedPhotoFile } from '../photos/photo-upload.validator';
import {
  QuickTransferSessionDto,
  QuickTransferStatusDto,
  QuickTransferUploadResultDto,
} from './dto/quick-transfer-session.dto';
import { QuickTransferService } from './quick-transfer.service';

const mobilePageContentSecurityPolicy =
  "default-src 'self'; form-action 'self'; style-src 'unsafe-inline'";

@ApiTags('quick-transfer')
@Controller('quick-transfer')
export class QuickTransferController {
  constructor(private readonly quickTransferService: QuickTransferService) {}

  // 创建快传会话
  // 返回一个路径，前端会根据路径生成二维码
  @Post('projects/:projectId/sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: QuickTransferSessionDto })
  createSession(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
  ): Promise<QuickTransferSessionDto> {
    return this.quickTransferService.createSession(user.id, projectId);
  }

  @Get('sessions/:sessionId/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: QuickTransferStatusDto })
  getStatus(
    @CurrentUser() user: RequestUser,
    @Param('sessionId') sessionId: string,
  ): QuickTransferStatusDto {
    return this.quickTransferService.getStatus(user.id, sessionId);
  }

  // 扫码后浏览器访问后端，拿到一个HTML页面
  @Get('mobile/:sessionId')
  @Header('Content-Security-Policy', mobilePageContentSecurityPolicy)
  @Header('Content-Type', 'text/html; charset=utf-8')
  getMobilePage(@Param('sessionId') sessionId: string, @Query('token') token = ''): string {
    return this.quickTransferService.getMobilePage(sessionId, token);
  }

  // 上传图片接口
  @Post('sessions/:sessionId/upload')
  @Header('Content-Security-Policy', mobilePageContentSecurityPolicy)
  @Header('Content-Type', 'text/html; charset=utf-8')
  @UseInterceptors(FileInterceptor('file'))
  @ApiCreatedResponse({ type: QuickTransferUploadResultDto })
  async uploadPhoto(
    @Param('sessionId') sessionId: string,
    @Query('token') token = '',
    @UploadedFile() file: UploadedPhotoFile | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    try {
      await this.quickTransferService.uploadPhoto(sessionId, token, file);
      response.status(HttpStatus.CREATED);
      // 如果上传成功，则给手机端返回上传成功HTML页面
      return this.quickTransferService.getUploadSuccessPage(sessionId, token);
    } catch {
      response.status(HttpStatus.BAD_REQUEST);
      return this.quickTransferService.getUploadFailedPage();
    }
  }
}
