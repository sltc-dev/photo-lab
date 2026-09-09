import { Module } from '@nestjs/common';
import { SecurityModule } from '../../common/security/security.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  controllers: [FeedbackController],
  imports: [PrismaModule, SecurityModule],
  providers: [FeedbackService],
})
export class FeedbackModule {}
