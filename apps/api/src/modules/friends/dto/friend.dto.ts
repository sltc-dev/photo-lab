import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FriendRequestStatus } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFriendRequestDto {
  @ApiProperty({ type: String, maxLength: 128 })
  @IsString()
  @MaxLength(128)
  recipientUserId!: string;
}

export class FriendRequestListQueryDto {
  @ApiProperty({ enum: ['incoming', 'outgoing'] })
  @IsIn(['incoming', 'outgoing'])
  direction!: 'incoming' | 'outgoing';

  @ApiPropertyOptional({ enum: FriendRequestStatus, enumName: 'FriendRequestStatus' })
  @IsOptional()
  @IsIn(Object.values(FriendRequestStatus))
  status?: FriendRequestStatus;
}

export class FriendRequestDto {
  @ApiProperty({ type: String })
  requestId!: string;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ enum: FriendRequestStatus, enumName: 'FriendRequestStatus' })
  status!: FriendRequestStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  requestedAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  relationshipId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  removedAt!: string | null;
}

export class FriendDto {
  @ApiProperty({ type: String })
  relationshipId!: string;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  username!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class FriendRequestPageDto {
  @ApiProperty({ type: [FriendRequestDto] })
  items!: FriendRequestDto[];
}

export class FriendPageDto {
  @ApiProperty({ type: [FriendDto] })
  items!: FriendDto[];
}
