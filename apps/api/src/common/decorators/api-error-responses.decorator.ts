import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
  ApiForbiddenResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

type ErrorStatus =
  | HttpStatus.FORBIDDEN
  | HttpStatus.TOO_MANY_REQUESTS
  | HttpStatus.BAD_REQUEST
  | HttpStatus.CONFLICT
  | HttpStatus.INTERNAL_SERVER_ERROR
  | HttpStatus.NOT_FOUND
  | HttpStatus.PAYLOAD_TOO_LARGE
  | HttpStatus.UNAUTHORIZED
  | HttpStatus.UNSUPPORTED_MEDIA_TYPE;

export function ApiErrorResponses(...statuses: ErrorStatus[]): MethodDecorator & ClassDecorator {
  // 这是 OpenAPI 文档装饰器的组合，不参与运行时异常处理。
  const decorators = statuses.map((status) => {
    const options = { type: ErrorResponseDto };

    switch (status) {
      case HttpStatus.FORBIDDEN:
        return ApiForbiddenResponse(options);
      case HttpStatus.TOO_MANY_REQUESTS:
        return ApiTooManyRequestsResponse(options);
      case HttpStatus.BAD_REQUEST:
        return ApiBadRequestResponse(options);
      case HttpStatus.CONFLICT:
        return ApiConflictResponse(options);
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return ApiInternalServerErrorResponse(options);
      case HttpStatus.NOT_FOUND:
        return ApiNotFoundResponse(options);
      case HttpStatus.PAYLOAD_TOO_LARGE:
        return ApiPayloadTooLargeResponse(options);
      case HttpStatus.UNAUTHORIZED:
        return ApiUnauthorizedResponse(options);
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return ApiUnsupportedMediaTypeResponse(options);
    }
  });

  // Controller 只写一行，就能声明该接口的所有标准错误响应。
  return applyDecorators(...decorators);
}
