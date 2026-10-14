import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsNumber, Max, Min } from 'class-validator';

export class LocationSettingsDto {
  @ApiProperty({ type: Boolean })
  locationEnabled!: boolean;

  @ApiProperty({ type: Boolean })
  discoverable!: boolean;
}

export class UpdateLocationSettingsDto extends LocationSettingsDto {
  @IsBoolean()
  declare locationEnabled: boolean;

  @IsBoolean()
  declare discoverable: boolean;
}

export class ResolveLocationAddressDto {
  @ApiProperty({ minimum: -90, maximum: 90, type: Number })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180, type: Number })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class LocationAddressDto {
  @ApiProperty({ type: String })
  label!: string;
}

export class ReportLocationDto {
  @ApiProperty({ minimum: -90, maximum: 90, type: Number })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ minimum: -180, maximum: 180, type: Number })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ minimum: 0, maximum: 100000, type: Number })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.000001)
  @Max(100000)
  accuracyMeters!: number;

  @ApiProperty({ format: 'date-time', type: String })
  @IsDateString({ strict: true })
  capturedAt!: string;
}

export class LocationDto extends ReportLocationDto {
  @ApiProperty({ format: 'date-time', type: String })
  expiresAt!: string;
}

export const relationshipStates = [
  'NONE',
  'OUTGOING_PENDING',
  'INCOMING_PENDING',
  'FRIEND',
  'COOLDOWN',
] as const;

export class NearbyUserDto {
  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ type: Number })
  approximateDistanceMeters!: number;

  @ApiProperty({ enum: relationshipStates })
  relationshipState!: (typeof relationshipStates)[number];

  @ApiProperty({ type: String, nullable: true })
  requestId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  relationshipId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  cooldownUntil!: string | null;
}

export class NearbyUsersDto {
  @ApiProperty({ type: [NearbyUserDto] })
  items!: NearbyUserDto[];

  @ApiProperty({ type: Number })
  radiusMeters!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  searchedAt!: string;
}
