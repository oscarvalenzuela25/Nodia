import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { envs } from '../../config/envs.config.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  onModuleInit() {
    try {
      this.client = new Redis({
        host: envs.REDIS_HOST,
        port: envs.REDIS_PORT,
        password: envs.REDIS_PASSWORD,
        maxRetriesPerRequest: 1,
        enableReadyCheck: false,
        lazyConnect: true,
        retryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 200, 1000);
        },
      });

      this.client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}`);
      });

      this.client.connect().catch((err) => {
        this.logger.warn(`Could not connect to Redis: ${err.message}`);
      });
    } catch (error: any) {
      this.logger.warn(`Redis initialization error: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const data = await this.client.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error: any) {
      this.logger.warn(`Redis GET failed for key "${key}": ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error: any) {
      this.logger.warn(`Redis SET failed for key "${key}": ${error.message}`);
    }
  }

  async del(key: string | string[]): Promise<void> {
    if (!this.client) return;
    try {
      const keys = Array.isArray(key) ? key : [key];
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error: any) {
      this.logger.warn(`Redis DEL failed: ${error.message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      const stream = this.client.scanStream({
        match: pattern,
        count: 100,
      });

      await new Promise<void>((resolve) => {
        stream.on('data', async (keys: string[]) => {
          if (keys.length > 0 && this.client) {
            stream.pause();
            try {
              const pipeline = this.client.pipeline();
              keys.forEach((k) => pipeline.del(k));
              await pipeline.exec();
            } catch (err: any) {
              this.logger.warn(`Redis pipeline DEL error: ${err.message}`);
            } finally {
              stream.resume();
            }
          }
        });
        stream.on('end', () => resolve());
        stream.on('error', (err) => {
          this.logger.warn(`Redis scanStream error for pattern "${pattern}": ${err.message}`);
          resolve();
        });
      });
    } catch (error: any) {
      this.logger.warn(`Redis delByPattern failed for pattern "${pattern}": ${error.message}`);
    }
  }

  async flushAll(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.flushall();
    } catch (error: any) {
      this.logger.warn(`Redis flushAll failed: ${error.message}`);
    }
  }
}
