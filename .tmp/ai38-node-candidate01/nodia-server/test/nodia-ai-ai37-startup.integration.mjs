// Compiled entrypoints with all socket connections forbidden, no .env or live service.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = mkdtempSync(path.join(tmpdir(), 'nodia-ai37-startup-'));
const checks = [];
try {
  const preload = path.join(root, 'deny-network.cjs');
  for (const entry of ['main', 'nodia-ai-worker']) {
    for (const [mode, error] of [
      ['quarantine', 'nodia_ai:quarantine_blocks_startup'],
      ['invalid', 'nodia_ai:invalid_operation_mode'],
    ]) {
      const counter = path.join(root, `${entry}-${mode}.json`);
      writeFileSync(preload, `const net = require('node:net');
const fs = require('node:fs');
const attempts = { sockets: 0, fetch: 0 };
const deny = () => { attempts.sockets++; throw Error('AI37_UNEXPECTED_SOCKET_CONNECTION'); };
net.Socket.prototype.connect = deny;
net.connect = net.createConnection = deny;
globalThis.fetch = () => { attempts.fetch++; throw Error('AI37_UNEXPECTED_FETCH'); };
process.on('exit', () => fs.writeFileSync(${JSON.stringify(counter)}, JSON.stringify(attempts)));
`);
      const env = {
        PATH: process.env.PATH ?? '',
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        NODE_ENV: 'test',
        RATE_LIMIT_STORAGE: 'memory',
        DOTENV_CONFIG_PATH: path.join(root, 'nonexistent.env'),
        NODIA_AI_OPERATION_MODE: mode,
      };
      const result = spawnSync(process.execPath,
        ['--require', preload, fileURLToPath(new URL(`../dist/${entry}.js`, import.meta.url))],
        { cwd: root, env, encoding: 'utf8', timeout: 20000, maxBuffer: 65536 });
      assert.equal(result.error, undefined, `${entry} control failed to run`);
      assert.notEqual(result.status, 0, `${entry} must refuse startup`);
      assert.ok(result.stderr.includes(error), `${entry} must reject its operation mode`);
      assert.ok(!`${result.stdout}${result.stderr}`.includes('AI37_UNEXPECTED_SOCKET_CONNECTION'),
        `${entry} attempted a socket connection before the gate`);
      assert.ok(!result.stdout.includes('Starting Nest application'), `${entry} created a Nest context`);
      assert.deepEqual(JSON.parse(readFileSync(counter, 'utf8')), { sockets: 0, fetch: 0 },
        `${entry} attempted network activity, even if a dependency swallowed the error`);
      checks.push({ entry, mode, refused_before_application_context: true, attempted_socket_connections: 0 });
    }
  }
  console.log(JSON.stringify({ stage: 'AI-37', scope: 'compiled_quarantine_startup_without_environment_or_network',
    status: 'passed', checks, provider_requests: 0, configured_database_touched: false }));
} finally {
  assert.equal(path.dirname(root), path.resolve(tmpdir()));
  assert.ok(path.basename(root).startsWith('nodia-ai37-startup-'));
  rmSync(root, { recursive: true, force: true });
}
