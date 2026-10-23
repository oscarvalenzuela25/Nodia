// AI39 protocol integration against compiled CodexRpc and real Linux JSONL subprocesses.
// Migrates six direct-helper unit scenarios; no network, account, inference or SQL.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { CodexRpc } from '../dist/common/ai/codex/codex-rpc.js';
import { CODEX_SETTINGS } from '../dist/common/ai/codex/codex-contract.js';
import { CodexChatToolChannelUseCase } from '../dist/ai-provider/use-case/codex-chat-tool-channel.use-case.js';
import { assertCodexGroupEmpty } from '../dist/common/ai/codex/codex-process-ownership.js';
assert.equal(process.platform, 'linux', 'Owned-process integration requires Linux');
const root = await mkdtemp(join(tmpdir(), 'nodia-ai39-protocol-'));
assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
const peer = fileURLToPath(new URL('./fixtures/codex-chat-protocol-peer.mjs', import.meta.url));
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const executable = join(root, 'synthetic-peer');
await writeFile(executable, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(peer)} "$@"\n`, { mode: 0o700 });
const active = new Set(), pids = [], results = [];
let currentCase = 'setup';
async function waitFor(predicate, milliseconds = 15000) {
  const deadline = Date.now() + milliseconds;
  while (!predicate()) { assert.ok(Date.now() < deadline, 'Synthetic condition deadline exceeded'); await delay(10); }
}
async function make(mode) {
  const folder = join(root, mode); await mkdir(folder, { mode: 0o700 });
  await writeFile(join(folder, 'protocol-fixture.json'), JSON.stringify({ mode, settings: CODEX_SETTINGS }), { mode: 0o600 });
  const rpc = new CodexRpc(executable, folder, folder, folder);
  active.add(rpc); assert.ok(Number.isSafeInteger(rpc.ownedPid)); pids.push(rpc.ownedPid);
  return rpc;
}
async function close(rpc) { await rpc.close(); await assertCodexGroupEmpty(rpc.ownedPid); active.delete(rpc); }
const rejected = () => ({ error: { code: -32600, message: 'Synthetic rejected request' } });
async function scenario(name, work) {
  currentCase = name; const started = performance.now();
  const detail = await work(); results.push({ case: name, passed: true, elapsed_ms: Math.round(performance.now() - started), ...detail });
}
try {
  await scenario('startup_snapshot_barrier', async () => {
    const rpc = await make('startup'), seen = [];
    let release; const barrier = new Promise(resolve => { release = resolve; });
    const detach = rpc.observeProtocol(async progress => { seen.push({ ...progress }); if (progress.frames === 1) await barrier; });
    const initialized = rpc.initialize({ experimentalChatApi: true }); void initialized.catch(() => undefined);
    try {
      await waitFor(() => seen.length === 1); await delay(60);
      assert.equal(seen.length, 1); assert.equal(seen[0].frames, 1);
      release(); await initialized; await detach();
      assert.deepEqual(seen.map(value => value.frames), [1, 2, 3, 4]);
      assert.ok(seen.every(value => value.requests === 0)); assert.ok(seen[3].bytes > seen[0].bytes);
      return { snapshots: seen.length, native_server_requests: 0 };
    } finally { release(); await close(rpc); }
  });
  await scenario('burst80_duplicate_call_once', async () => {
    const rpc = await make('burst'), seen = []; let calls = 0;
    const detach = rpc.observeProtocol(async progress => { seen.push({ ...progress }); });
    try {
      await rpc.initialize({ experimentalChatApi: true });
      const channel = new CodexChatToolChannelUseCase().execute({ threadId: 'synthetic-thread', turnId: 'synthetic-turn', toolNames: ['nodia_read'],
        deadlineAt: new Date(Date.now() + 15000), signal: new AbortController().signal,
        limits: { requests: 128, toolCalls: 12, argumentUtf8Bytes: 65536, resultUtf8Bytes: 65536, jsonDepth: 16, collectionItems: 128 },
        assertLease: async () => undefined, beforeRequest: async () => undefined,
        onUnforwardedRequest: () => rpc.recordUnforwardedRequest(), onToolCall: async () => { calls++; return { total: 0 }; } });
      const dispose = rpc.openChatToolChannel(channel);
      await rpc.request('fixture/burst', {}, 15000); await detach(); dispose();
      assert.equal(calls, 1); assert.equal(rpc.alive, true);
      assert.equal(seen.at(-1).frames, 85); assert.equal(seen.at(-1).requests, 2);
      assert.equal(seen.at(-1).unforwardedRequests, 1); assert.equal(seen.at(-1).overflow, false);
      for (let n = 1; n < seen.length; n++) for (const key of ['frames', 'requests', 'unforwardedRequests']) assert.ok(seen[n][key] >= seen[n - 1][key]);
      return { notifications: 80, native_server_requests: 2, gateway_calls: calls, unforwarded_requests: 1 };
    } finally { await close(rpc); }
  });
  await scenario('durable_barrier_before_gateway', async () => {
    const rpc = await make('barrier'); let calls = 0, entered = false, release;
    const barrier = new Promise(resolve => { release = resolve; });
    try {
      await rpc.initialize({ experimentalChatApi: true });
      const detach = rpc.observeProtocol(async progress => { if (progress.requests > 0) { entered = true; await barrier; } });
      rpc.openChatToolChannel({ handle: async () => { calls++; return rejected(); }, close: () => undefined });
      const request = rpc.request('fixture/request', {}, 15000); void request.catch(() => undefined);
      await waitFor(() => entered); await delay(60); assert.equal(calls, 0);
      release(); await request; await detach(); assert.equal(calls, 1);
      return { gateway_calls_before_barrier: 0, gateway_calls_after_barrier: calls };
    } finally { release(); await close(rpc); }
  });
  await scenario('oversized_partial_before_close', async () => {
    const rpc = await make('partial'), seen = []; let beforeClose = false;
    try {
      await rpc.initialize({ experimentalChatApi: true });
      const detach = rpc.observeProtocol(async progress => { seen.push({ ...progress }); if (progress.overflow) beforeClose = rpc.alive; });
      await assert.rejects(rpc.request('fixture/partial', {}, 15000)); await detach();
      assert.equal(rpc.alive, false); assert.equal(seen.length, 1); assert.equal(beforeClose, true);
      assert.equal(seen[0].frames, 1); assert.equal(seen[0].requests, 0); assert.equal(seen[0].unforwardedRequests, 0); assert.equal(seen[0].overflow, true);
      assert.ok(seen[0].bytes > 2 * 1024 * 1024);
      return { frames: 1, observed_overflow_before_close: true, bytes: seen[0].bytes, gateway_calls: 0 };
    } finally { await close(rpc); }
  });
  await scenario('durable_failure_blocks_callback', async () => {
    const rpc = await make('failure'); let calls = 0;
    try {
      await rpc.initialize({ experimentalChatApi: true });
      const detach = rpc.observeProtocol(async () => { throw Error('Synthetic durable barrier failure'); });
      rpc.openChatToolChannel({ handle: async () => { calls++; return rejected(); }, close: () => undefined });
      await assert.rejects(rpc.request('fixture/request', {}, 15000)); await detach();
      assert.equal(rpc.alive, false); assert.equal(calls, 0);
      return { gateway_calls: 0, native_closed: true };
    } finally { await close(rpc); }
  });
  await scenario('overflow18MiB_true_count_before_close', async () => {
    const rpc = await make('overflow'), seen = []; let beforeClose = false;
    try {
      await rpc.initialize({ experimentalChatApi: true });
      const detach = rpc.observeProtocol(async progress => { seen.push({ ...progress }); if (progress.overflow) beforeClose = rpc.alive; });
      await assert.rejects(rpc.request('fixture/overflow', {}, 15000)); await detach();
      assert.equal(rpc.alive, false); assert.equal(seen.at(-1).overflow, true); assert.equal(beforeClose, true);
      assert.ok(seen.at(-1).bytes > 18 * 1024 * 1024); assert.equal(seen.at(-1).frames, 9);
      return { frames: 9, bytes: seen.at(-1).bytes, observed_overflow_before_close: true, gateway_calls: 0 };
    } finally { await close(rpc); }
  });
  await scenario('hidden_handshake_request_is_charged_and_rejected', async () => {
    const rpc = await make('hidden'), seen = []; let rejectedRequests = 0;
    rpc.on('toolRejected', () => { rejectedRequests++; });
    const detach = rpc.observeProtocol(async progress => { seen.push({ ...progress }); });
    try {
      await rpc.initialize({ experimentalChatApi: true }); await detach();
      assert.equal(rpc.alive, true); assert.equal(rejectedRequests, 1);
      assert.equal(seen.at(-1).requests, 1); assert.equal(seen.at(-1).unforwardedRequests, 1);
      return { native_server_requests: 1, rejected_requests: 1, unforwarded_requests: 1, gateway_calls: 0 };
    } finally { await close(rpc); }
  });
  for (const pid of pids) await assertCodexGroupEmpty(pid);
  console.log(JSON.stringify({ status: 'passed', cases: results, process_groups_closed: pids.length,
    inference_requests: 0, account_reads: 0, sql_queries: 0, simulated_peer: true, real_jsonl_processes: true }));
} catch (error) {
  console.log(JSON.stringify({ status: 'failed', case: currentCase, completed_cases: results,
    error: error?.name ?? 'Error', code: typeof error?.code === 'string' ? error.code : null }));
  process.exitCode = 1;
} finally {
  for (const rpc of active) await close(rpc);
  const folder = await stat(root); assert.ok(folder.isDirectory());
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep)); await rm(root, { recursive: true });
}
