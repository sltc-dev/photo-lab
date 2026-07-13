import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Module({
  exports: [JwtModule, JwtAuthGuard],
  imports: [JwtModule.register({}), PrismaModule],
  providers: [JwtAuthGuard],
})
export class SecurityModule {}
