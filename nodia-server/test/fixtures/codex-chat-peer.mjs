// Synthetic JSONL peer for AI39 integration. Never contacts a provider or uses an account.
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { CODEX_SETTINGS } from '../../dist/common/ai/codex/codex-contract.js';

const send = (value) => process.stdout.write(JSON.stringify(value) + '\n');
const threadId = 'synthetic-thread-' + randomUUID();
const turnId = 'synthetic-turn-' + randomUUID();
let scenario = 'answer', waiting = false;
const finish = () => {
  if (scenario === 'crash_after_tool') process.exit(23);
  if (scenario === 'hang_after_tool') return;
  send({ method: 'item/completed', params: { threadId, turnId,
    item: { id: 'synthetic-answer', type: 'agentMessage', phase: 'final_answer', text: 'AI39 synthetic gateway completed' } } });
  send({ method: 'turn/completed', params: { threadId, turn: { id: turnId, status: 'completed', items: [], error: null } } });
};
for await (const line of createInterface({ input: process.stdin })) {
  const request = JSON.parse(line);
  if (!request.method) {
    if (request.id === 'synthetic-knowledge-request' && waiting) {
      waiting = false;
      if (request.error || request.result?.success !== true) process.exit(24);
      finish();
    }
    continue;
  }
  if (request.id === undefined) continue;
  const reply = (result) => send({ id: request.id, result });
  switch (request.method) {
    case 'initialize': reply({ userAgent: 'synthetic-ai39-peer/1' }); break;
    case 'config/read': reply({ config: CODEX_SETTINGS }); break;
    case 'account/read': reply({ account: { type: 'chatgpt', planType: 'synthetic-fixture' } }); break;
    case 'account/rateLimits/read': reply({ ordinaryUsageAllowed: true }); break;
    case 'model/list': reply({ data: [{ id: 'synthetic-ai39-model', model: 'synthetic-ai39-model',
      displayName: 'Synthetic fixture model', inputModalities: ['text'],
      supportedReasoningEfforts: [{ reasoningEffort: 'high' }] }], nextCursor: null }); break;
    case 'thread/start': reply({ thread: { id: threadId } }); break;
    case 'thread/unsubscribe': reply({}); break;
    case 'turn/interrupt':
      reply({});
      send({ method: 'turn/completed', params: { threadId, turn: { id: turnId, status: 'interrupted', items: [], error: null } } });
      break;
    case 'turn/start': {
      const input = JSON.stringify(request.params.input);
      scenario = input.includes('AI39_CRASH_AFTER_TOOL') ? 'crash_after_tool'
        : input.includes('AI39_HANG_AFTER_TOOL') ? 'hang_after_tool'
        : input.includes('AI39_TOOL') ? 'tool' : 'answer';
      reply({ turn: { id: turnId, status: 'inProgress', items: [], error: null } });
      setTimeout(() => {
        if (scenario === 'answer') finish();
        else {
          waiting = true;
          send({ id: 'synthetic-knowledge-request', method: 'item/tool/call', params: {
            threadId, turnId, callId: 'synthetic-knowledge-call', tool: 'nodia_knowledge_index', arguments: {},
          } });
        }
      }, 30);
      break;
    }
    default: send({ id: request.id, error: { code: -32601, message: 'Synthetic peer method unavailable' } });
  }
}
