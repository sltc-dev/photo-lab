import { Module } from '@nestjs/common';
import { SecurityModule } from '../../common/security/security.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  // Controller 负责 HTTP，AuthService 负责认证业务；其余能力通过 imports 注入。
  controllers: [AuthController],
  imports: [PrismaModule, SecurityModule, UsersModule],
  providers: [AuthService],
})
export class AuthModule {}
