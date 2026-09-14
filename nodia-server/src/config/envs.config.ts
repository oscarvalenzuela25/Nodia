import 'dotenv/config';
import { readRateLimitConfig } from '../rate-limit/rate-limit.config.js';

export const configModuleEnvs = () => ({
  RATE_LIMIT: readRateLimitConfig(process.env),
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  POSTGRES_DB: process.env.POSTGRES_DB || 'nodia_db',
  POSTGRES_PORT: process.env.POSTGRES_PORT
    ? parseInt(process.env.POSTGRES_PORT)
    : 5432,
  POSTGRES_HOST: process.env.POSTGRES_HOST || 'localhost',
  POSTGRES_USER: process.env.POSTGRES_USER || 'nodia_user',
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || 'nodia_password',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  SECRET_SEED: process.env.SECRET_SEED || '',
});

export const envs = configModuleEnvs();
