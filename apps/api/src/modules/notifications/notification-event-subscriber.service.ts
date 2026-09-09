import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';
import type { AppEnv } from '../../config/env';
import { NOTIFICATION_REDIS_CHANNEL, parseNotificationPublishedEvent } from './notification-event';
import { NotificationStreamService } from './notification-stream.service';

/** 订阅 CLI 发布的 Redis 事件，并转发给当前 API 进程中的 SSE 连接。 */
@Injectable()
export class NotificationEventSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEventSubscriber.name);
  private client: RedisClientType | null = null;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService<AppEnv, true>,
    @Inject(NotificationStreamService) private readonly stream: NotificationStreamService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get('REDIS_URL');

    if (!url) {
      this.logger.warn('REDIS_URL is not configured; real-time notification events are disabled');
      return;
    }

    this.client = createClient({ url });
    this.client.on('error', (error) => this.logger.error('Redis subscriber error', error));
    await this.client.connect();
    await this.client.subscribe(NOTIFICATION_REDIS_CHANNEL, (message) => {
      const event = parseNotificationPublishedEvent(message);

      if (event) {
        this.stream.publish(event);
      } else {
        this.logger.warn('Ignored an invalid notification event from Redis');
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }
}
