import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { mergeMap } from 'rxjs';
import { TeacherService } from './teacher.service.js';
import type { AuthRequest } from '../auth/types/auth.types.js';

/** HTTP status is part of the immutable admission receipt, including recovered commands. */
@Injectable()
export class TeacherReceiptStatusInterceptor implements NestInterceptor {
  constructor(private readonly store: TeacherService) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<AuthRequest & Request>();
    if (request.method === 'GET') return next.handle();
    const key = request.headers['idempotency-key'];
    // The command validates the UUID; intercept only successful committed commands.
    return next.handle().pipe(
      mergeMap(async (value) => {
        if (typeof key === 'string') {
          const [receipt]: { http_status: number }[] =
            await this.store.source.query(
              'SELECT http_status FROM teacher_requests WHERE actor_id=$1 AND request_key=$2',
              [request.auth.user.id, key],
            );
          if (receipt)
            context
              .switchToHttp()
              .getResponse<Response>()
              .status(receipt.http_status);
        }
        return value;
      }),
    );
  }
}
