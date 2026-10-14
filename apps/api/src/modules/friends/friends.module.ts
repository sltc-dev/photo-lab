import { Module } from '@nestjs/common';
import { SecurityModule } from '../../common/security/security.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { LocationsModule } from '../locations/locations.module';
import { NotificationCoreModule } from '../notifications/notification-core.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({
  imports: [PrismaModule, SecurityModule, LocationsModule, NotificationCoreModule],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}
