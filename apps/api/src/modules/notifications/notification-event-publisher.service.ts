import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';
import type { AppEnv } from '../../config/env';
import { NOTIFICATION_REDIS_CHANNEL, type NotificationPublishedEvent } from './notification-event';

/** 将通知事件发布到 Redis，使 CLI 和 HTTP API 可以跨进程通信。 */
@Injectable()
export class NotificationEventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationEventPublisher.name);
  private client: RedisClientType | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService<AppEnv, true>) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.get('REDIS_URL');

    if (!url) {
      this.logger.warn('REDIS_URL is not configured; real-time notification events are disabled');
      return;
    }

    this.client = createClient({ url });
    this.client.on('error', (error) => this.logger.error('Redis publisher error', error));
    await this.client.connect();
  }

  async publish(event: NotificationPublishedEvent): Promise<void> {
    if (this.client?.isReady) {
      await this.client.publish(NOTIFICATION_REDIS_CHANNEL, JSON.stringify(event));
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }
}
