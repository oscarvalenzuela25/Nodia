import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const serverDirectory = fileURLToPath(new URL('../', import.meta.url));
const cliUrl = new URL('../scripts/qualify-teacher-text.mjs', import.meta.url);
// Import the real CLI after installing fail-closed boundaries. No fixture database,
// provider, credential or operational draft is needed for this startup gate.
const childSource = `
  import { DataSource } from 'typeorm';
  let dbCalls = 0, posts = 0;
  DataSource.prototype.initialize = async function () {
    dbCalls += 1;
    throw new Error('TEST_DATABASE_ACCESS_FORBIDDEN');
  };
  globalThis.fetch = async () => {
    posts += 1;
    throw new Error('TEST_NETWORK_ACCESS_FORBIDDEN');
  };
  process.argv = [process.execPath, ${JSON.stringify(fileURLToPath(cliUrl))},
    '--session-id=11111111-1111-4111-8111-111111111111',
    '--user-id=9007199254740993',
    '--auth-session-public-id=22222222-2222-4222-8222-222222222222'];
  try {
    await import(${JSON.stringify(cliUrl.href)});
  } catch {
    process.exitCode = 71;
  } finally {
    console.log(JSON.stringify({ dbCalls, posts }));
  }
`;

function parseSafeOutput(value, label) {
  try {
    return JSON.parse(value.trim());
  } catch {
    // Never echo raw process output into an assertion or test report.
    assert.fail(`${label} must contain exactly one JSON object`);
  }
}

for (const [mode, expectedCode] of [
  ['quarantine', 'nodia_ai:quarantine_blocks_startup'],
  ['invalid-test-mode', 'nodia_ai:invalid_operation_mode'],
]) {
  test(`qualification CLI rejects ${mode} before database initialization or POST`, () => {
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '--eval', childSource],
      {
        cwd: serverDirectory,
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 16384,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          RATE_LIMIT_STORAGE: 'memory',
          DOTENV_CONFIG_PATH: process.platform === 'win32' ? 'NUL' : '/dev/null',
          NODIA_AI_OPERATION_MODE: mode,
        },
      },
    );
    assert.ok(!result.error, 'CLI subprocess must complete within its deadline');
    assert.equal(result.status, 1);
    const boundaries = parseSafeOutput(result.stdout, 'Boundary counters');
    const rejection = parseSafeOutput(result.stderr, 'CLI rejection');
    assert.ok(boundaries.dbCalls === 0, 'Database must not be initialized');
    assert.ok(boundaries.posts === 0, 'No provider POST may be attempted');
    assert.ok(rejection.code === expectedCode, 'Preserve the safe operation-mode code');
    assert.ok(rejection.stage === 'operation_mode', 'Identify the preflight gate');
    assert.ok(rejection.dispatched === false, 'Report that no dispatch occurred');
    assert.ok(rejection.retry === false, 'Do not invite automatic replay');
    assert.ok(!('action' in rejection), 'Do not suggest an unknown provider result before dispatch');
  });
}
