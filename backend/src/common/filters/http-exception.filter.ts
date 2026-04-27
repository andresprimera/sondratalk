import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { type ApiErrorResponse, type FieldError } from '@base-dashboard/shared';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: FieldError[] | undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const body = exceptionResponse as Record<string, unknown>;
        message =
          typeof body['message'] === 'string'
            ? body['message']
            : String(body['message'] ?? exception.message);
        if (Array.isArray(body['errors'])) {
          errors = body['errors'] as FieldError[];
        }
      }
    }

    const errorResponse: ApiErrorResponse = { statusCode, message };
    if (errors) {
      errorResponse.errors = errors;
    }

    response.status(statusCode).json(errorResponse);
  }
}
