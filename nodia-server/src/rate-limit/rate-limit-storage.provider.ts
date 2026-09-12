import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorageService } from '@nestjs/throttler';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';
import { envs } from '../config/envs.config.js';

@Injectable()
export class RateLimitStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly logger = new Logger(RateLimitStorage.name);
  private readonly storage: ThrottlerStorage;
  private readonly redis?: Redis;
  private readonly memory?: ThrottlerStorageService;
  private unavailable = false;
  private lastWarningAt = 0;

  constructor() {
    if (envs.RATE_LIMIT.storage === 'memory') {
      this.memory = new ThrottlerStorageService();
      this.storage = this.memory;
      return;
    }

    const options = {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: envs.RATE_LIMIT.commandTimeout,
      connectTimeout: 2000,
      retryStrategy: (attempt: number) => Math.min(attempt * 250, 5000),
    };
    this.redis = envs.RATE_LIMIT.redisUrl
      ? new Redis(envs.RATE_LIMIT.redisUrl, options)
      : new Redis({
          ...options,
          host: envs.REDIS_HOST,
          port: envs.REDIS_PORT,
          password: envs.REDIS_PASSWORD,
        });
    this.redis.on('error', () => this.reportUnavailable());
    this.storage = new ThrottlerStorageRedisService(this.redis);
  }

  private reportUnavailable(): void {
    this.unavailable = true;
    const now = Date.now();
    if (now - this.lastWarningAt >= 30_000) {
      this.logger.warn(
        'Rate-limit storage unavailable; protected requests return 503',
      );
      this.lastWarningAt = now;
    }
  }

  async increment(...args: Parameters<ThrottlerStorage['increment']>) {
    try {
      const result = await this.storage.increment(...args);
      if (this.unavailable) {
        this.logger.log('Rate-limit storage recovered');
        this.unavailable = false;
      }
      return result;
    } catch {
      this.reportUnavailable();
      throw new ServiceUnavailableException({
        error: 'RATE_LIMIT_UNAVAILABLE',
        message: 'core:rate_limit_unavailable',
      });
    }
  }

  onApplicationShutdown(): void {
    this.redis?.disconnect();
    this.memory?.onApplicationShutdown();
  }
}
