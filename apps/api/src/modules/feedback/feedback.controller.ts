import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({ type: CreateFeedbackDto })
  @ApiCreatedResponse({ type: FeedbackDto })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateFeedbackDto): Promise<FeedbackDto> {
    return this.feedbackService.create(user.id, dto);
  }
}
