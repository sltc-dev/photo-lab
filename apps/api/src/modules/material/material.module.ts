import { Module } from '@nestjs/common';
import { MaterialController } from './material.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { SecurityModule } from '../../common/security/security.module';
import { MaterialUserService } from './material-users.service';
import { MaterialPhotosService } from './material-photos.service';

//用来声明一个类是nestjs的一个模块
@Module({
  //MaterialController 属于 MaterialModule，需要由 NestJS 创建并注册其中的路由。
  controllers: [MaterialController],
  // 这里的 imports 表示当前模块依赖的其他 NestJS 模块。
  imports: [PrismaModule, SecurityModule],
  //表示 MaterialService 是当前模块提供和管理的 Provider。
  providers: [MaterialUserService, MaterialPhotosService],
})
export class MaterialModule {}
