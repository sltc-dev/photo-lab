import { ApiProperty } from '@nestjs/swagger';
import type { NearbyFriendsConfig } from '../../../config/nearby-friends.config';

export class LocationConfigDto {
  @ApiProperty({ type: Number })
  ttlMs!: number;

  @ApiProperty({ type: Number })
  refreshIntervalMs!: number;

  @ApiProperty({ type: Number })
  maxClockSkewMs!: number;
}

export class NearbyConfigDto {
  @ApiProperty({ type: Number })
  radiusMeters!: number;

  @ApiProperty({ type: Number })
  maxAccuracyMeters!: number;

  @ApiProperty({ type: Number })
  distanceBucketMeters!: number;
}

export class FriendRequestConfigDto {
  @ApiProperty({ type: Number })
  ttlMs!: number;

  @ApiProperty({ type: Number })
  cooldownMs!: number;
}

export class MaintenanceConfigDto {
  @ApiProperty({ type: Number })
  intervalMs!: number;
}

export class FriendListConfigDto {
  @ApiProperty({ type: Number })
  refetchIntervalMs!: number;
}

export class NearbyFriendsConfigDto implements NearbyFriendsConfig {
  @ApiProperty({ type: LocationConfigDto })
  location!: LocationConfigDto;

  @ApiProperty({ type: NearbyConfigDto })
  nearby!: NearbyConfigDto;

  @ApiProperty({ type: FriendRequestConfigDto })
  friendRequest!: FriendRequestConfigDto;

  @ApiProperty({ type: MaintenanceConfigDto })
  maintenance!: MaintenanceConfigDto;

  @ApiProperty({ type: FriendListConfigDto })
  list!: FriendListConfigDto;
}
