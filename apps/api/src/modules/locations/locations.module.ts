import { LocationAddressService } from './location-address.service';
import { Module } from '@nestjs/common';
import { SecurityModule } from '../../common/security/security.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { FriendRequestMaintenanceService } from './friend-request-maintenance.service';
import { nearbyFriendsConfigProvider } from '../../config/nearby-friends.config';

@Module({
  imports: [PrismaModule, SecurityModule],
  controllers: [LocationsController],
  providers: [
    LocationAddressService,
    LocationsService,
    FriendRequestMaintenanceService,
    nearbyFriendsConfigProvider,
  ],
  exports: [LocationsService, 'NEARBY_FRIENDS_CONFIG'],
})
export class LocationsModule {}
