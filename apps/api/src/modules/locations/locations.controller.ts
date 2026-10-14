import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiErrorResponses } from '../../common/decorators/api-error-responses.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { RequestUser } from '../../common/types/authenticated-request';
import {
  LocationDto,
  LocationAddressDto,
  ResolveLocationAddressDto,
  LocationSettingsDto,
  NearbyUsersDto,
  ReportLocationDto,
  UpdateLocationSettingsDto,
} from './dto/location.dto';
import { LocationAddressService } from './location-address.service';
import { LocationsService } from './locations.service';
import { NearbyFriendsConfigDto } from './dto/nearby-friends-config.dto';

@ApiTags('locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiErrorResponses(
  HttpStatus.BAD_REQUEST,
  HttpStatus.UNAUTHORIZED,
  HttpStatus.CONFLICT,
  HttpStatus.TOO_MANY_REQUESTS,
)
@Controller('locations')
export class LocationsController {
  constructor(
    private readonly locations: LocationsService,
    private readonly addresses: LocationAddressService,
  ) {}

  @Post('address')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ type: ResolveLocationAddressDto })
  @ApiOkResponse({ type: LocationAddressDto })
  resolveLocationAddress(@Body() dto: ResolveLocationAddressDto) {
    return this.addresses.resolveAddressFromCoordinates(dto);
  }

  @Get('config')
  @ApiOkResponse({ type: NearbyFriendsConfigDto })
  getNearbyFriendsConfig(): NearbyFriendsConfigDto {
    return this.locations.config;
  }

  @Get('settings')
  @ApiOkResponse({ type: LocationSettingsDto })
  getLocationSettings(@CurrentUser() user: RequestUser) {
    return this.locations.getSettings(user.id);
  }

  @Patch('settings')
  @ApiBody({ type: UpdateLocationSettingsDto })
  @ApiOkResponse({ type: LocationSettingsDto })
  updateLocationSettings(@CurrentUser() user: RequestUser, @Body() dto: UpdateLocationSettingsDto) {
    return this.locations.updateSettings(user.id, dto);
  }

  @Put('me')
  @ApiBody({ type: ReportLocationDto })
  @ApiOkResponse({ type: LocationDto })
  reportLocation(@CurrentUser() user: RequestUser, @Body() dto: ReportLocationDto) {
    return this.locations.reportLocation(user.id, dto);
  }

  @Get('me')
  @ApiOkResponse({
    schema: { nullable: true, allOf: [{ $ref: '#/components/schemas/LocationDto' }] },
  })
  getMyLocation(@CurrentUser() user: RequestUser) {
    return this.locations.getLocation(user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteMyLocation(@CurrentUser() user: RequestUser) {
    return this.locations.deleteLocation(user.id);
  }

  @Get('nearby')
  @ApiOkResponse({ type: NearbyUsersDto })
  getNearbyUsers(@CurrentUser() user: RequestUser) {
    return this.locations.getNearby(user.id);
  }
}
