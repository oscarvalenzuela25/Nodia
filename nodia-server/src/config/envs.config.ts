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
  // Gemini Web microservice (browser session)
  GEMINI_MICROSERVICE_URL:
    process.env.GEMINI_MICROSERVICE_URL || 'http://127.0.0.1:8000',
  // Mistral AI
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || '',
  MISTRAL_MODEL: process.env.MISTRAL_MODEL || 'open-mistral-nemo',
  MISTRAL_OCR_MODEL: process.env.MISTRAL_OCR_MODEL || 'mistral-ocr-latest',
  // Cloudflare R2
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
  R2_ENDPOINT: process.env.R2_ENDPOINT || '',
});

export const envs = configModuleEnvs();

export const hasR2Config = (): boolean => {
  return Boolean(
    envs.R2_ACCOUNT_ID &&
    envs.R2_ACCESS_KEY_ID &&
    envs.R2_SECRET_ACCESS_KEY &&
    envs.R2_BUCKET_NAME,
  );
};

export const canUseGemini = (): boolean => {
  return Boolean(envs.GEMINI_MICROSERVICE_URL && hasR2Config());
};

export const canUseMistral = (): boolean => {
  return Boolean(envs.MISTRAL_API_KEY && hasR2Config());
};

export const canAnalyzeInvoice = (): boolean => {
  return Boolean((canUseGemini() || canUseMistral()) && hasR2Config());
};
