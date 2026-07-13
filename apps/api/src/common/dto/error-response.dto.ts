import { ApiProperty } from '@nestjs/swagger';
import { ERROR_CODES, type ErrorCode } from '../errors/app.exception';

export class ErrorBodyDto {
  @ApiProperty({ enum: ERROR_CODES, enumName: 'ErrorCode' })
  code!: ErrorCode;

  @ApiProperty({ nullable: true, type: Object })
  details!: Record<string, unknown> | null;

  @ApiProperty({ type: String })
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ type: ErrorBodyDto })
  error!: ErrorBodyDto;
}
