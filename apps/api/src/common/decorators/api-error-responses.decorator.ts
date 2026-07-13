import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

type ErrorStatus =
  | HttpStatus.BAD_REQUEST
  | HttpStatus.CONFLICT
  | HttpStatus.INTERNAL_SERVER_ERROR
  | HttpStatus.NOT_FOUND
  | HttpStatus.UNAUTHORIZED;

export function ApiErrorResponses(...statuses: ErrorStatus[]): MethodDecorator & ClassDecorator {
  // 这是 OpenAPI 文档装饰器的组合，不参与运行时异常处理。
  const decorators = statuses.map((status) => {
    const options = { type: ErrorResponseDto };

    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ApiBadRequestResponse(options);
      case HttpStatus.CONFLICT:
        return ApiConflictResponse(options);
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ApiInternalServerErrorResponse(options);
      case HttpStatus.NOT_FOUND:
        return ApiNotFoundResponse(options);
      case HttpStatus.UNAUTHORIZED:
        return ApiUnauthorizedResponse(options);
    }
  });

  // Controller 只写一行，就能声明该接口的所有标准错误响应。
  return applyDecorators(...decorators);
}
