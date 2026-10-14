import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { NearbyFriendsConfig } from '../../config/nearby-friends.config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FriendRequestMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly logger = new Logger(FriendRequestMaintenanceService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject('NEARBY_FRIENDS_CONFIG') private readonly config: NearbyFriendsConfig,
  ) {}

  onModuleInit(): void {
    if (process.env.SKIP_PRISMA_CONNECT === 'true') return;

    this.timer = setInterval(
      () => void this.markExpiredRequests(),
      this.config.maintenance.intervalMs,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async markExpiredRequests(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      await this.prisma
        .$executeRaw`UPDATE "FriendRequest" SET "status" = 'EXPIRED', "resolvedAt" = "expiresAt", "updatedAt" = CURRENT_TIMESTAMP WHERE "status" = 'PENDING' AND "expiresAt" <= CURRENT_TIMESTAMP`;
    } catch {
      this.logger.warn(
        'Friend request maintenance failed; expired requests remain excluded from active queries.',
      );
    } finally {
      this.running = false;
    }
  }
}
