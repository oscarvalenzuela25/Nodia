import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal Server Error';

    let message: string | object = 'Internal Server Error';
    let error = 'Internal Server Error';

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const respObj = exceptionResponse as Record<string, unknown>;
      message = (respObj.message as string | object) || exceptionResponse;
      error =
        (respObj.error as string) ||
        (exception instanceof HttpException ? exception.name : 'Error');
    } else if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      error = exception instanceof HttpException ? exception.name : 'Error';
    }

    // These expected failures are aggregated by the limiter/storage to avoid
    // logging a stack trace for every rejected request during a flood/outage.
    const rateLimitFailure =
      (status === HttpStatus.TOO_MANY_REQUESTS &&
        error === 'RATE_LIMIT_EXCEEDED') ||
      (status === HttpStatus.SERVICE_UNAVAILABLE &&
        error === 'RATE_LIMIT_UNAVAILABLE');
    if (rateLimitFailure) {
      response.setHeader('Cache-Control', 'no-store');
    } else {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${status} - Message: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message,
    });
  }
}
