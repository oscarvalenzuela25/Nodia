import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CodexOperationException } from '../ai/codex/codex-contract.js';
import { GeminiUpstreamException } from '../ai/gemini-upstream.exception.js';
import { randomUUID } from 'node:crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    if (exception instanceof GeminiUpstreamException && exception.retryAfterSeconds !== null) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal Server Error';
    if (request.path === '/api/v1/nodia-ai' || request.path.startsWith('/api/v1/nodia-ai/')) {
      const detail = exceptionResponse && typeof exceptionResponse === 'object'
        ? exceptionResponse as Record<string, unknown> : null;
      const candidate = typeof exceptionResponse === 'string' ? exceptionResponse : detail?.message;
      const code = typeof candidate === 'string' && /^(?:nodia_ai|auth):[a-z0-9_]{1,100}$/.test(candidate)
        ? candidate : status === 400 || status === 413 ? 'nodia_ai:invalid_input'
        : status === 401 ? 'auth:session_expired' : status === 403 ? 'nodia_ai:capability_denied'
        : status === 404 ? 'nodia_ai:conversation_not_found' : 'nodia_ai:request_failed';
      const provided = response.getHeader('X-Request-Id');
      const correlationId = typeof provided === 'string' && /^[a-f0-9-]{36}$/i.test(provided) ? provided : randomUUID();
      const retry = detail?.retry_after_seconds;
      if (status === HttpStatus.TOO_MANY_REQUESTS && typeof retry === 'number' && Number.isSafeInteger(retry) && retry > 0)
        response.setHeader('Retry-After', String(retry));
      response.setHeader('Cache-Control','no-store');
      response.setHeader('X-Request-Id',correlationId);
      this.logger.warn({event:'nodia_ai_http_error',status,code,correlation_id:correlationId});
      response.status(status).json({error:{code,message_key:code,field_errors:[],
        retry_action:status===409?'manual_after_review':'none',correlation_id:correlationId}});
      return;
    }
    if (request.path.startsWith('/api/v1/nodia-ai/') && exceptionResponse && typeof exceptionResponse === 'object') {
      const retry = (exceptionResponse as Record<string, unknown>).retry_after_seconds;
      if (status === HttpStatus.TOO_MANY_REQUESTS && typeof retry === 'number' && Number.isSafeInteger(retry) && retry > 0)
        response.setHeader('Retry-After', String(retry));
    }

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
      const details =
        exception instanceof Error ? exception.stack || exception.message : String(exception);
      this.logger.error(
        `[${request.method}] ${request.path} - Status: ${status} - Type: ${error} - Details: ${details}`,
      );
    }

    if (status >= 500 && !(exception instanceof HttpException) && !rateLimitFailure) {
      message = 'Internal Server Error';
      error = 'Internal Server Error';
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      method: request.method,
      error,
      message,
      ...(exception instanceof CodexOperationException ? { code: exception.code, ...(exception.requestId ? { requestId: exception.requestId } : {}) } : {}),
      ...(exception instanceof GeminiUpstreamException && typeof exceptionResponse === 'object'
        ? { upstreamRequestId: (exceptionResponse as Record<string, unknown>).upstreamRequestId,
          ...(exception.upstreamErrorCode ? { upstreamErrorCode: exception.upstreamErrorCode } : {}) }
        : {}),
    });
  }
}
