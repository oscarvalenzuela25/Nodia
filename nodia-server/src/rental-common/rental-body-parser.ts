import {
  BadRequestException,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { json, type RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

const logger = new Logger('RentalHTTP');
const parse = json({ limit: '64kb' });

/** Scope parser limits and safe HTTP errors to the rental transport. */
export const rentalBodyParser: RequestHandler = (request, response, next) => {
  const requestId = randomUUID(),
    started = Date.now();
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Request-Id', requestId);
  response.once('finish', () =>
    logger.log({
      request_id: requestId,
      method: request.method,
      route: request.route?.path ?? '/api/v1/rental',
      status: response.statusCode,
      duration_ms: Date.now() - started,
    }),
  );
  parse(request, response, (error?: unknown) => {
    const type =
      error && typeof error === 'object' && 'type' in error
        ? error.type
        : undefined;
    if (type === 'entity.too.large')
      return next(new PayloadTooLargeException('rental:invalid_input'));
    if (type === 'entity.parse.failed')
      return next(new BadRequestException('rental:invalid_input'));
    next(error);
  });
};
