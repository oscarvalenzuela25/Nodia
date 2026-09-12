import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerLimitDetail, ThrottlerRequest } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { envs } from '../config/envs.config.js';
import { normalizeRateLimitIp } from './rate-limit.config.js';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected readonly policyNames = ['burst', 'general', 'writes', 'login'];

  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter((policy) =>
      this.policyNames.includes(policy.name ?? 'default'),
    );
  }

  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly rejections = new Map<
    string,
    { count: number; loggedAt: number }
  >();

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    return context.switchToHttp().getRequest<Request>().method === 'OPTIONS';
  }

  protected async getTracker(request: Request): Promise<string> {
    return normalizeRateLimitIp(request.ip);
  }

  protected generateKey(
    _context: ExecutionContext,
    tracker: string,
    name: string,
  ): string {
    const identity = createHash('sha256').update(tracker).digest('hex');
    return `${envs.RATE_LIMIT.prefix}:${name}:${identity}`;
  }

  protected async handleRequest(request: ThrottlerRequest): Promise<boolean> {
    try {
      return await super.handleRequest(request);
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      ) {
        // One bounded counter per configured policy, without URLs, tokens or IPs.
        const name = request.throttler.name ?? 'default';
        const entry = this.rejections.get(name) ?? { count: 0, loggedAt: 0 };
        entry.count += 1;
        const now = Date.now();
        if (now - entry.loggedAt >= 30_000) {
          this.logger.warn(
            `Rate limit exceeded: policy=${name} rejected=${entry.count}`,
          );
          entry.count = 0;
          entry.loggedAt = now;
        }
        this.rejections.set(name, entry);
      }
      throw error;
    }
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();
    // Both supported storages return the remaining block duration in seconds.
    response.setHeader(
      'Retry-After',
      Math.max(1, Math.ceil(detail.timeToBlockExpire)),
    );
    response.setHeader('Cache-Control', 'no-store');
    throw new HttpException(
      { error: 'RATE_LIMIT_EXCEEDED', message: 'core:rate_limit_exceeded' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
