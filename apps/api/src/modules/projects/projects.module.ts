import { Module } from '@nestjs/common';
import { SecurityModule } from '../../common/security/security.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  controllers: [ProjectsController],
  imports: [PrismaModule, SecurityModule],
  providers: [ProjectsService],
})
export class ProjectsModule {}
