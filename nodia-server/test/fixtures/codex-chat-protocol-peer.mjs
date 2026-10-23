// Synthetic JSONL process for AI39 protocol integration only. No SDK, account or network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
const fixture = JSON.parse(readFileSync(join(process.env.CODEX_HOME, 'protocol-fixture.json'), 'utf8'));
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
async function bytes(value) { if (!process.stdout.write(value)) await once(process.stdout, 'drain'); }
const call = (id = 'same-call') => ({ threadId: 'synthetic-thread', turnId: 'synthetic-turn', namespace: null,
  callId: id, tool: 'nodia_read', arguments: { zero: 0 } });
let pendingScenario;
const lines = createInterface({ input: process.stdin, terminal: false });
lines.on('line', raw => {
  let message; try { message = JSON.parse(raw); } catch { process.exitCode = 2; lines.close(); return; }
  if (message.method === 'initialize') {
    send({ id: message.id, result: {} });
    if (fixture.mode === 'startup') {
      send({ method: 'synthetic/one', params: {} }); send({ method: 'synthetic/two', params: {} });
    }
    if (fixture.mode === 'hidden') send({ id: 'hidden-before-channel', method: 'shell/execute', params: { command: 'synthetic-never-executed' } });
    return;
  }
  if (message.method === 'config/read') { send({ id: message.id, result: { config: fixture.settings } }); return; }
  if (message.method === 'initialized') return;
  if (message.method === 'fixture/burst') {
    pendingScenario = message.id; send({ id: 'one', method: 'item/tool/call', params: call() }); return;
  }
  if (message.id === 'one' && message.result && fixture.mode === 'burst') {
    process.stdout.write(Array.from({ length: 80 }, (_, n) => JSON.stringify({ method: 'item/agentMessage/delta',
      params: { threadId: 'synthetic-thread', turnId: 'synthetic-turn', delta: String(n) } })).join('\n') + '\n');
    send({ id: 'two', method: 'item/tool/call', params: call() }); return;
  }
  if (message.id === 'two' && message.error && fixture.mode === 'burst') { send({ id: pendingScenario, result: { completed: true } }); return; }
  if (message.method === 'fixture/request') {
    pendingScenario = message.id; send({ id: 'one', method: 'item/tool/call', params: call() }); return;
  }
  if (message.id === 'one' && message.error && fixture.mode === 'barrier') { send({ id: pendingScenario, result: { completed: true } }); return; }
  if (message.method === 'fixture/partial') { void bytes('x'.repeat(2 * 1024 * 1024 + 1)); return; }
  if (message.method === 'fixture/overflow') {
    void (async () => {
      for (let n = 0; n < 8; n++) await bytes(JSON.stringify({ method: 'synthetic/notification',
        params: { padding: 'x'.repeat(2 * 1024 * 1024 - 256) } }) + '\n');
      await bytes('x'.repeat(2 * 1024 * 1024 + 4096));
    })().catch(() => undefined);
    return;
  }
  if (message.id === 'hidden-before-channel' && message.error) return;
  if (message.method) send({ id: message.id, error: { code: -32601, message: 'Synthetic method unavailable' } });
});
process.stdout.on('error', () => { lines.close(); process.exitCode = 0; });
