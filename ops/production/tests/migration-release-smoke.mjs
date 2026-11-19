import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const port = 3100;
const postgresEnvironment = [
  'POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD',
  'PGSSLMODE', 'PGSSLROOTCERT', 'NODE_EXTRA_CA_CERTS',
];

export async function verifyReleaseStartup(releaseDirectory, database) {
  assert.equal(process.env.POSTGRES_HOST, 'update-pg', 'disposable PostgreSQL is required');
  assert.equal(process.env.PGSSLMODE, 'verify-full', 'verified PostgreSQL TLS is required');
  assert.match(database, /^[a-z][a-z0-9_]{0,62}$/, 'invalid rehearsal database name');
  const connection = Object.fromEntries(postgresEnvironment
    .filter(name => process.env[name] !== undefined)
    .map(name => [name, process.env[name]]));
  const env = {
    ...connection,
    PATH: process.env.PATH,
    HOME: '/tmp',
    NODE_ENV: 'production',
    DOTENV_CONFIG_PATH: '/dev/null',
    POSTGRES_DB: database,
    PORT: String(port),
    REDIS_HOST: 'update-redis',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    AUTH_JWT_SECRET: randomBytes(32).toString('hex'),
    AUTH_ALLOWED_ORIGINS: 'https://migration-fixture.invalid',
    GOOGLE_CLIENT_ID: 'migration-fixture.apps.googleusercontent.com',
    AI_SECRET_MASTER_KEY: randomBytes(32).toString('hex'),
    GEMINI_SERVICE_TOKEN: randomBytes(32).toString('hex'),
  };
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: releaseDirectory, env, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let diagnostics = '';
  child.stderr.setEncoding('utf8').on('data', chunk => {
    diagnostics = (diagnostics + chunk).slice(-4000);
  });
  let outcome;
  const stopped = new Promise(resolve => {
    child.once('error', error => { diagnostics += error.message; });
    child.once('close', (code, signal) => {
      outcome = { code, signal };
      resolve(outcome);
    });
  });

  try {
    const deadline = performance.now() + 45_000;
    let responseStatus = null;
    while (!outcome && performance.now() < deadline) {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1`, {
        redirect: 'manual', signal: AbortSignal.timeout(1000),
      }).catch(() => null);
      if (response) {
        responseStatus = response.status;
        if (response.ok && await response.text() === 'Hello World!') {
          return { http_status: response.status, api_started: true };
        }
        await response.body?.cancel().catch(() => {});
      }
      await Promise.race([stopped, delay(250, undefined, { ref: false })]);
    }
    throw new Error(`Packaged API did not become ready (exit ${JSON.stringify(outcome ?? null)}, HTTP ${responseStatus}): ${diagnostics}`);
  } finally {
    if (!outcome) child.kill('SIGTERM');
    await Promise.race([stopped, delay(5000, undefined, { ref: false })]);
    if (!outcome) {
      child.kill('SIGKILL');
      await stopped;
    }
  }
}
