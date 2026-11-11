import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RuntimeValidationError, validateEnvironmentValues, validateNodeVersion, validateDrainWindow,
} from '../validate-runtime-env.mjs';

function environment() {
  return {
    NODE_ENV: 'production', PGSSLMODE: 'verify-full',
    POSTGRES_HOST: 'database.example.invalid', POSTGRES_PORT: '29102', POSTGRES_DB: 'fixture_db',
    POSTGRES_USER: 'fixture_user', POSTGRES_PASSWORD: 'fixture-secret-not-for-network',
    REDIS_HOST: '127.0.0.1', REDIS_PORT: '6379', REDIS_PASSWORD: 'fixture-redis-not-for-network',
    RATE_LIMIT_STORAGE: 'redis', AI_SECRET_MASTER_KEY: 'a'.repeat(64), GEMINI_SERVICE_TOKEN: 'b'.repeat(64),
    NODIA_AI_OPERATION_MODE: 'normal', HOME: '/var/lib/nodia/home', NODIA_CODEX_PROFILE_ROOT: '/var/lib/nodia/codex',
    NODIA_AI_RECOVERY_CONFIG_FILE: '/var/lib/nodia/config/recovery.json',
  };
}

test('accepts the explicit private-host production configuration without touching network', () => {
  assert.doesNotThrow(() => validateEnvironmentValues(environment()));
});

test('rejects unsafe transport, split Redis, development defaults and missing recovery', () => {
  const cases = [
    ['PGSSLMODE', 'require'], ['NODE_TLS_REJECT_UNAUTHORIZED', '0'],
    ['POSTGRES_HOST', 'postgresql://fixture.invalid'], ['POSTGRES_HOST', '127.0.0.1'],
    ['POSTGRES_PORT', '29102junk'], ['POSTGRES_PORT', '65536'],
    ['POSTGRES_USER', 'nodia_user'], ['POSTGRES_PASSWORD', 'nodia_password'],
    ['REDIS_HOST', 'external.example.invalid'], ['REDIS_PASSWORD', 'nodia_redis_password'],
    ['RATE_LIMIT_STORAGE', 'memory'], ['RATE_LIMIT_REDIS_URL', 'redis://external.example.invalid'],
    ['PGHOSTADDR', '192.0.2.1'], ['AI_SECRET_MASTER_KEY', 'wrong'],
    ['NODIA_AI_OPERATION_MODE', 'quarantine'], ['HOME', '/home/nodia-admin'],
    ['NODIA_AI_RECOVERY_CONFIG_FILE', undefined],
  ];
  for (const [field, value] of cases) {
    assert.throws(() => validateEnvironmentValues({ ...environment(), [field]: value }),
      (error) => error instanceof RuntimeValidationError && error.checks.some((check) => check.field === field), field);
  }
});

test('rejection exposes fixed field codes instead of secret values', () => {
  const secret = 'NEVER_EMIT_THIS_SYNTHETIC_SECRET';
  try {
    validateEnvironmentValues({ ...environment(), GEMINI_SERVICE_TOKEN: secret });
    assert.fail('Expected invalid secret rejection');
  } catch (error) {
    assert.ok(error instanceof RuntimeValidationError);
    assert.equal(JSON.stringify(error.checks).includes(secret), false);
    assert.equal(error.message.includes(secret), false);
  }
});

test('requires the installed Node24 baseline while permitting later compatible patches', () => {
  for (const version of ['24.22.2', '24.22.3', '24.23.0']) assert.doesNotThrow(() => validateNodeVersion(version));
  for (const version of ['22.22.0', '24.20.0', '24.22.1', '25.0.0', 'invalid']) {
    assert.throws(() => validateNodeVersion(version), RuntimeValidationError);
  }
});

test('future drain policy must leave room before systemd stops the process', () => {
  assert.doesNotThrow(() => validateDrainWindow({ timing: { drain_seconds: 150 } }));
  for (const drain of [180, 181, undefined, 0]) {
    assert.throws(() => validateDrainWindow({ timing: { drain_seconds: drain } }), RuntimeValidationError);
  }
});
