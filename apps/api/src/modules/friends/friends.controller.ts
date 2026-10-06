import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  CreateFriendRequestDto,
  FriendPageDto,
  FriendRequestDto,
  FriendRequestListQueryDto,
  FriendRequestPageDto,
} from './dto/friend.dto';
import { FriendsService } from './friends.service';

@ApiTags('friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiErrorResponses(
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.FORBIDDEN,
  HttpStatus.NOT_FOUND,
  HttpStatus.CONFLICT,
  HttpStatus.TOO_MANY_REQUESTS,
)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: CreateFriendRequestDto })
  @ApiOkResponse({ type: FriendRequestDto })
  sendFriendRequest(@CurrentUser() user: RequestUser, @Body() dto: CreateFriendRequestDto) {
    return this.friends.createRequest(user.id, dto);
  }

  @Get('requests')
  @ApiQuery({ name: 'direction', enum: ['incoming', 'outgoing'] })
  @ApiOkResponse({ type: FriendRequestPageDto })
  listFriendRequests(@CurrentUser() user: RequestUser, @Query() query: FriendRequestListQueryDto) {
    return this.friends.listRequests(user.id, query);
  }

  @Post('requests/:requestId/accept')
  @ApiParam({ name: 'requestId', type: String })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: FriendRequestDto })
  acceptFriendRequest(@CurrentUser() user: RequestUser, @Param('requestId') requestId: string) {
    return this.friends.resolveRequest(user.id, requestId, 'accept');
  }

  @Post('requests/:requestId/reject')
  @ApiParam({ name: 'requestId', type: String })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: FriendRequestDto })
  rejectFriendRequest(@CurrentUser() user: RequestUser, @Param('requestId') requestId: string) {
    return this.friends.resolveRequest(user.id, requestId, 'reject');
  }

  @Post('requests/:requestId/cancel')
  @ApiParam({ name: 'requestId', type: String })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: FriendRequestDto })
  cancelFriendRequest(@CurrentUser() user: RequestUser, @Param('requestId') requestId: string) {
    return this.friends.resolveRequest(user.id, requestId, 'cancel');
  }

  @Get()
  @ApiOkResponse({ type: FriendPageDto })
  listFriends(@CurrentUser() user: RequestUser) {
    return this.friends.listFriends(user.id);
  }

  @Delete(':relationshipId')
  @ApiParam({ name: 'relationshipId', type: String })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeFriend(@CurrentUser() user: RequestUser, @Param('relationshipId') relationshipId: string) {
    return this.friends.removeFriend(user.id, relationshipId);
  }
}
