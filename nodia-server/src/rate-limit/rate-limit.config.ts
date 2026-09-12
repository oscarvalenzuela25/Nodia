import ipaddr from 'ipaddr.js';
import { isIP } from 'node:net';

function positiveInteger(
  environment: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = environment[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export function readRateLimitConfig(environment: NodeJS.ProcessEnv) {
  const runtime = environment.NODE_ENV ?? 'development';
  const storage = environment.RATE_LIMIT_STORAGE ?? 'redis';
  if (storage !== 'redis' && storage !== 'memory') {
    throw new Error('RATE_LIMIT_STORAGE must be redis or memory');
  }
  if (storage === 'memory' && !['development', 'test'].includes(runtime)) {
    throw new Error('Memory rate limiting is only allowed in development/test');
  }

  const prefix = environment.RATE_LIMIT_KEY_PREFIX ?? `nodia:${runtime}:rl:v1`;
  if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(prefix)) {
    throw new Error(
      'RATE_LIMIT_KEY_PREFIX must contain 1-100 letters, digits, :, _ or -',
    );
  }

  // Trust explicit proxy addresses/subnets, never arbitrary forwarded headers.
  const trustedProxies = environment.TRUST_PROXY?.trim()
    ? environment.TRUST_PROXY.split(',').map((value) => value.trim())
    : [];
  for (const proxy of trustedProxies) {
    try {
      if (!isIP(proxy.split('/')[0])) throw new Error('Invalid IP');
      if (proxy.includes('/')) ipaddr.parseCIDR(proxy);
    } catch {
      throw new Error(
        'TRUST_PROXY must be a comma-separated list of proxy IPs/CIDRs',
      );
    }
  }

  const policy = (name: string, limit: number, ttl: number) => ({
    limit: positiveInteger(environment, `RATE_LIMIT_${name}_LIMIT`, limit),
    ttl: positiveInteger(environment, `RATE_LIMIT_${name}_TTL_MS`, ttl),
    blockDuration: positiveInteger(
      environment,
      `RATE_LIMIT_${name}_BLOCK_MS`,
      positiveInteger(environment, `RATE_LIMIT_${name}_TTL_MS`, ttl),
    ),
  });

  const redisUrl = environment.RATE_LIMIT_REDIS_URL;
  if (redisUrl) {
    let parsed: URL;
    try {
      parsed = new URL(redisUrl);
    } catch {
      throw new Error('RATE_LIMIT_REDIS_URL must be a valid Redis URL');
    }
    if (!['redis:', 'rediss:'].includes(parsed.protocol)) {
      throw new Error('RATE_LIMIT_REDIS_URL must use redis:// or rediss://');
    }
  }

  return {
    storage,
    prefix,
    trustedProxies,
    redisUrl,
    commandTimeout: positiveInteger(
      environment,
      'RATE_LIMIT_REDIS_TIMEOUT_MS',
      1000,
    ),
    burst: policy('BURST', 30, 10_000),
    general: policy('GENERAL', 300, 60_000),
    writes: policy('WRITES', 30, 60_000),
    login: policy('LOGIN', 10, 60_000),
    user: policy('USER', 300, 60_000),
    userWrites: policy('USER_WRITES', 30, 60_000),
  };
}

export function normalizeRateLimitIp(ip: string | undefined): string {
  if (!ip || !ipaddr.isValid(ip)) return 'unknown';
  const address = ipaddr.process(ip);
  if (address.kind() === 'ipv4') return `ipv4:${address.toString()}`;
  const subnet = ipaddr.IPv6.networkAddressFromCIDR(
    `${address.toNormalizedString()}/64`,
  );
  return `ipv6:${subnet.toNormalizedString()}/64`;
}
