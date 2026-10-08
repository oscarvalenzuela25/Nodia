// Synthetic protocol peer. Never part of production or connected to OpenAI.
import { createInterface } from 'node:readline';
import { CODEX_SETTINGS } from '../../dist/common/ai/codex/codex-contract.js';
const send = (value) => process.stdout.write(JSON.stringify(value) + '\n');
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (request.id == null || typeof request.method !== 'string') continue;
  if (request.method === 'peer/invalid') {
    process.stdout.write('{bad-json\n');
    continue;
  }
  if (request.method === 'peer/overflow') {
    process.stdout.write('x'.repeat(2 * 1024 * 1024 + 1));
    continue;
  }
  if (request.method === 'peer/crash') process.exit(2);
  if (request.method === 'peer/hang') continue;
  if (request.method === 'peer/tool')
    send({
      id: 'tool',
      method: 'item/commandExecution/requestApproval',
      params: {},
    });
  const result =
    request.method === 'config/read'
      ? { config: CODEX_SETTINGS }
      : request.method === 'peer/env'
        ? Object.keys(process.env)
        : request.params;
  const bytes = Buffer.from(JSON.stringify({ id: request.id, result }) + '\n');
  for (let offset = 0; offset < bytes.length; offset += 7) {
    await new Promise((resolve) =>
      process.stdout.write(bytes.subarray(offset, offset + 7), resolve),
    );
  }
}
