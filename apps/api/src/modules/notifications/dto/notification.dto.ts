import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationLevel, NotificationType } from '@prisma/client';

export class NotificationListItemDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ enum: NotificationType, enumName: 'NotificationType' })
  type!: NotificationType;

  @ApiProperty({ enum: NotificationLevel, enumName: 'NotificationLevel' })
  level!: NotificationLevel;

  @ApiProperty({ type: String })
  title!: string;

  @ApiProperty({ type: String })
  summary!: string;

  @ApiProperty({ type: Boolean })
  isRead!: boolean;

  @ApiProperty({ format: 'date-time', type: String })
  publishedAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, type: String })
  expiresAt!: string | null;
}

export class NotificationDetailDto extends NotificationListItemDto {
  @ApiProperty({ description: '通知正文，使用纯文本或 Markdown 展示', type: String })
  content!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  targetVersion!: string | null;
}

export class NotificationPageDto {
  @ApiProperty({ isArray: true, type: NotificationListItemDto })
  items!: NotificationListItemDto[];

  @ApiPropertyOptional({ nullable: true, type: String })
  nextCursor!: string | null;

  @ApiProperty({ description: '当前用户的未读通知总数', type: Number })
  unreadCount!: number;
}

export class NotificationReadDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: Boolean })
  isRead!: true;

  @ApiProperty({ format: 'date-time', type: String })
  readAt!: string;
}
