// Isolated non-generative handshake using the installed app's own RPC boundary.
// No account/read, model/list, login, inference or real connection profile.
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

let rpc;
let temporary;
let closed = false;
try {
  if (process.platform !== 'linux' || process.arch !== 'x64' || process.getuid() === 0 ||
      process.env.DBUS_SESSION_BUS_ADDRESS !== 'unix:path=/run/nodia-codex/bus') throw new Error('invalid_environment');
  const root = '/opt/nodia/current';
  const require = createRequire(join(root, 'package.json'));
  const { CodexRpc } = await import(pathToFileURL(join(root, 'dist/common/ai/codex/codex-rpc.js')).href);
  const executable = join(dirname(require.resolve('@openai/codex-linux-x64/package.json')),
    'vendor/x86_64-unknown-linux-musl/bin/codex');
  temporary = await mkdtemp('/tmp/nodia-codex-owned-probe-');
  const profile = join(temporary, 'profile');
  await mkdir(profile, { mode: 0o700 });
  rpc = new CodexRpc(executable, temporary, profile, '/var/lib/nodia/home');
  await rpc.initialize();
  await rpc.close();
  closed = true;
  console.log(JSON.stringify({ status: 'verified', native_protocol_verified: true,
    real_profile_used: false, account_requests: 0, inference_requests: 0, native_closed: true }));
} catch {
  console.log(JSON.stringify({ status: 'failed', error_code: 'codex_native_probe_failed' }));
  process.exitCode = 1;
} finally {
  if (rpc && !closed) {
    try { await rpc.close(); closed = true; } catch { process.exitCode = 1; }
  }
  // PrivateTmp is owned by this oneshot; never touch a configured profile.
  if (temporary && closed) await rm(temporary, { recursive: true });
}
