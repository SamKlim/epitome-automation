import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'object' &&
        'message' in exceptionResponse
          ? (exceptionResponse as any).message
          : exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    Sentry.captureException(exception, {
      tags: {
        service: 'epitome-assessment',
      },
      contexts: {
        http: {
          method: request.method,
          url: request.url,
          status_code: status,
        },
      },
      user: {
        ip_address: request.ip,
      },
    });

    this.logger.error(`Exception: ${message}`, exception);

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
