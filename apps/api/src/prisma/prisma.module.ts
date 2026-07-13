import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({
  // exports 之后，导入 PrismaModule 的业务模块才能注入 PrismaService。
  exports: [PrismaService],
  providers: [PrismaService],
})
export class PrismaModule {}
