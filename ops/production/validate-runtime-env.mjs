#!/usr/bin/env node
// Local ExecStartPre validation only. Never imports an application module or uses network clients.
import { constants } from 'node:fs';
import { access, lstat, readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export class RuntimeValidationError extends Error {
  constructor(checks) {
    super('Runtime configuration is invalid');
    this.checks = checks;
  }
}

const required = (value) => typeof value === 'string' && value.trim().length > 0;
const port = (value) => typeof value === 'string' && /^\d{1,5}$/.test(value) && Number(value) > 0 && Number(value) <= 65535;
const dnsHostname = (value) => required(value) && value.length <= 253 && value.includes('.') && !isIP(value) &&
  value.split('.').every((label) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label));

/** Error labels are fixed strings, never rejected values or underlying exception text. */
export function validateEnvironmentValues(environment) {
  const checks = [];
  const check = (condition, field, code = 'invalid') => {
    if (!condition) checks.push({ field, code });
  };
  check(environment.NODE_ENV === 'production', 'NODE_ENV');
  check(environment.PGSSLMODE === 'verify-full', 'PGSSLMODE');
  check(environment.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'NODE_TLS_REJECT_UNAUTHORIZED');
  check(!environment.PGHOSTADDR, 'PGHOSTADDR', 'must_not_pin_application_address');
  check(dnsHostname(environment.POSTGRES_HOST), 'POSTGRES_HOST', 'external_dns_required');
  check(port(environment.POSTGRES_PORT), 'POSTGRES_PORT');
  check(required(environment.POSTGRES_DB), 'POSTGRES_DB', 'required');
  check(required(environment.POSTGRES_USER) && environment.POSTGRES_USER !== 'nodia_user', 'POSTGRES_USER', 'explicit_non_default_required');
  check(required(environment.POSTGRES_PASSWORD) && environment.POSTGRES_PASSWORD !== 'nodia_password', 'POSTGRES_PASSWORD', 'explicit_non_default_required');
  check(environment.REDIS_HOST === '127.0.0.1', 'REDIS_HOST', 'private_loopback_required');
  check(environment.REDIS_PORT === '6379', 'REDIS_PORT');
  check(required(environment.REDIS_PASSWORD) && environment.REDIS_PASSWORD !== 'nodia_redis_password', 'REDIS_PASSWORD', 'explicit_non_default_required');
  check(environment.RATE_LIMIT_STORAGE === 'redis', 'RATE_LIMIT_STORAGE');
  check(!environment.RATE_LIMIT_REDIS_URL, 'RATE_LIMIT_REDIS_URL', 'shared_local_redis_required');
  for (const field of ['AI_SECRET_MASTER_KEY', 'GEMINI_SERVICE_TOKEN']) {
    check(typeof environment[field] === 'string' && /^[0-9a-fA-F]{64}$/.test(environment[field]), field);
  }
  check(environment.NODIA_AI_OPERATION_MODE === 'normal', 'NODIA_AI_OPERATION_MODE');
  check(environment.HOME === '/var/lib/nodia/home', 'HOME');
  check(environment.NODIA_CODEX_PROFILE_ROOT === '/var/lib/nodia/codex', 'NODIA_CODEX_PROFILE_ROOT');
  check(environment.NODIA_AI_RECOVERY_CONFIG_FILE === '/var/lib/nodia/config/recovery.json', 'NODIA_AI_RECOVERY_CONFIG_FILE');
  if (checks.length) throw new RuntimeValidationError(checks);
}

export function validateNodeVersion(version) {
  const parts = /^24\.(\d+)\.(\d+)$/.exec(version);
  if (!parts || Number(parts[1]) < 22 || (Number(parts[1]) === 22 && Number(parts[2]) < 2)) {
    throw new RuntimeValidationError([{ field: 'NODE_RUNTIME', code: 'requires_node_24_at_least_24_22_2' }]);
  }
}

/** Unit templates use TimeoutStopSec=180s. Reject a future policy that consumes that margin. */
export function validateDrainWindow(policy, stopSeconds = 180) {
  const drain = policy?.timing?.drain_seconds;
  if (!Number.isSafeInteger(drain) || drain <= 0 || drain >= stopSeconds) {
    throw new RuntimeValidationError([{ field: 'RUNTIME_POLICY', code: 'unit_stop_timeout_must_exceed_drain' }]);
  }
}

async function locally(field, operation) {
  try { return await operation(); }
  catch (error) {
    if (error instanceof RuntimeValidationError) throw error;
    throw new RuntimeValidationError([{ field, code: 'local_contract_check_failed' }]);
  }
}

const releaseFiles = [
  'package.json', 'package-lock.json', 'dist/main.js', 'dist/nodia-ai-worker.js',
  'dist/config/data-source.js', 'scripts/nodia-ai-journal.mjs', 'scripts/nodia-ai-backups.mjs',
  'dist/nodia-ai-conversation/config/conversation-policy.json',
  'dist/nodia-ai-runtime/config/runtime-policy.json',
  'dist/nodia-ai-context/config/knowledge-pin.json', 'dist/nodia-ai-context/config/knowledge-schema.json',
  'dist/nodia-ai/knowledge/manifest.json',
];

/** These imports have been audited to define validators only, with no application/network initialization. */
export async function validateRuntimeEnvironment(environment = process.env, releaseRoot = process.cwd()) {
  validateNodeVersion(process.versions.node);
  validateEnvironmentValues(environment);
  const root = resolve(releaseRoot);
  await locally('RELEASE_FILES', async () => {
    for (const name of releaseFiles) {
      const path = resolve(root, name);
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || !info.size) throw new Error();
      await access(path, constants.R_OK);
    }
    const metadata = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    if (metadata.name !== 'nodia-server' || metadata.type !== 'module') throw new Error();
    for (const name of releaseFiles.filter((name) => name.endsWith('.json'))) {
      JSON.parse(await readFile(resolve(root, name), 'utf8'));
    }
  });
  const compiled = (name) => import(pathToFileURL(resolve(root, 'dist', name)).href);
  await locally('AUTH_CONFIG', async () => {
    const { readAuthConfig } = await compiled('auth/auth.config.js');
    readAuthConfig(environment);
  });
  await locally('RATE_LIMIT_CONFIG', async () => {
    const { readRateLimitConfig } = await compiled('rate-limit/rate-limit.config.js');
    readRateLimitConfig(environment);
  });
  await locally('OPERATION_MODE', async () => {
    const { AssertNodiaAiOperationModeUseCase } = await compiled('nodia-ai-runtime/use-case/assert-nodia-ai-operation-mode.use-case.js');
    new AssertNodiaAiOperationModeUseCase().execute(environment);
  });
  await locally('RUNTIME_POLICY', async () => {
    const { ValidateNodiaAiRuntimePolicyUseCase } = await compiled('nodia-ai-runtime/use-case/validate-nodia-ai-runtime-policy.use-case.js');
    const envelope = JSON.parse(await readFile(resolve(root, 'dist/nodia-ai-runtime/config/runtime-policy.json'), 'utf8'));
    validateDrainWindow(new ValidateNodiaAiRuntimePolicyUseCase().execute(envelope));
  });
  await locally('CONVERSATION_POLICY', async () => {
    const { loadNodiaAiConversationPolicy } = await compiled('nodia-ai-conversation/config/conversation-policy.js');
    loadNodiaAiConversationPolicy();
  });
  await locally('RECOVERY_CONFIG', async () => {
    const { loadNodiaAiExternalRecoveryConfig } = await compiled('nodia-ai-recovery/nodia-ai-external-recovery.factory.js');
    // Do not call createNodiaAiExternalRecovery: this stage must not contact R2.
    loadNodiaAiExternalRecoveryConfig(environment.NODIA_AI_RECOVERY_CONFIG_FILE);
  });
  await locally('WRITABLE_STATE', async () => {
    for (const path of [environment.HOME, environment.NODIA_CODEX_PROFILE_ROOT]) {
      if (!isAbsolute(path)) throw new Error();
      const info = await lstat(path);
      if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
          (process.platform !== 'win32' && info.uid !== process.getuid())) throw new Error();
      await access(path, constants.R_OK | constants.W_OK | constants.X_OK);
    }
    if (environment.NODE_EXTRA_CA_CERTS) await access(environment.NODE_EXTRA_CA_CERTS, constants.R_OK);
  });
  return { status: 'locally_validated', network_checks_performed: false, application_started: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await validateRuntimeEnvironment()));
  } catch (error) {
    const checks = error instanceof RuntimeValidationError ? error.checks : [{ field: 'RUNTIME_CONFIG', code: 'local_check_failed' }];
    console.error(JSON.stringify({ status: 'invalid', checks }));
    process.exitCode = 1;
  }
}
