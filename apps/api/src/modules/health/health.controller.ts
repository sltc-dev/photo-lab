import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthDto } from './dto/health.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  // 这里只证明 API 进程能响应，不检查数据库是否可用。
  @Get()
  @ApiOkResponse({ type: HealthDto })
  health(): HealthDto {
    return { ok: true };
  }
}
