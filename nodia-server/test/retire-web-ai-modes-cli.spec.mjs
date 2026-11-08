import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

test(
  'accepts the sha256 option and refuses a wrong migration pin before DB, report or backup',
  { skip: process.platform !== 'linux' },
  () => {
    const directory = mkdtempSync(join(tmpdir(), 'nodia-cli-pin-regression-'));
    chmodSync(directory, 0o700);
    try {
      const runner =
        process.env.NODIA_MAINTENANCE_RUNNER_TEST_PATH ??
        fileURLToPath(
          new URL('../scripts/retire-web-ai-modes.mjs', import.meta.url),
        );
      const result = spawnSync(
        process.execPath,
        [
          runner,
          '--action=up',
          `--work-dir=${directory}`,
          `--report=${join(directory, 'up.json')}`,
          `--expected-migration-sha256=${'0'.repeat(64)}`,
        ],
        {
          cwd: directory,
          timeout: 5000,
          encoding: 'utf8',
          env: {
            PATH: process.env.PATH,
            DOTENV_CONFIG_PATH: '/dev/null',
            POSTGRES_HOST: '127.0.0.1',
            POSTGRES_PORT: '1',
            POSTGRES_USER: 'synthetic_cli_fixture',
            POSTGRES_PASSWORD: 'synthetic_cli_fixture_not_a_key',
            POSTGRES_DB: 'synthetic_cli_fixture',
          },
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1);
      const report = JSON.parse(result.stdout);
      assert.equal(report.error_code, 'maintenance:migration_pin_mismatch');
      assert.equal(report.failed_stage, 'configuration');
      assert.deepEqual(report.stages, []);
      assert.equal(report.backup, undefined);
      assert.equal(report.before_tables, undefined);
      assert.equal(report.provider_inferences, 0);
      assert.deepEqual(readdirSync(directory), []);
    } finally {
      // No recursive deletion: a failing regression preserves any unexpected files.
      if (readdirSync(directory).length === 0) rmdirSync(directory);
    }
  },
);
