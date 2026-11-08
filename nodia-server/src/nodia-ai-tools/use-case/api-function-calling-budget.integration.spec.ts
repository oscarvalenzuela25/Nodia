import { afterEach, expect, it, vi } from 'vitest';
import { toolFixture } from '../../../test/fixtures/nodia-ai-tools.fixture.js';
import { ExecuteNodiaAiKnowledgeToolUseCase } from '../../nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case.js';
import { executeApiChat } from '../../nodia-ai-adapter/api-nodia-ai-chat-transport.js';
import type { NodiaAiAdapterRequest } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';

afterEach(() => vi.restoreAllMocks());

it('charges a Server function callback once while preserving monotonic API response accounting', async () => {
  const f = toolFixture();
  f.run.selection_snapshot.mode = 'api_key';
  const originalQuery = f.query.getMockImplementation()!;
  f.query.mockImplementation(async (sql, parameters) => {
    if (
      sql.startsWith(
        'WITH changed AS (UPDATE nodia_ai_runs SET mcp_rpc_messages_used=',
      )
    )
      return [{ id: f.run.id }];
    if (
      sql === 'UPDATE nodia_ai_runs SET context_manifest=$2::jsonb WHERE id=$1'
    ) {
      f.run.context_manifest = JSON.parse(String(parameters?.[1]));
      return [];
    }
    return originalQuery(sql, parameters);
  });
  const ledger = new ExecuteNodiaAiKnowledgeToolUseCase(
    f.knowledge,
    f.authorize as unknown as AuthorizeNodiaAiUseCase,
    f.policy,
  );
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'function_call',
              call_id: 'fixture-api-call',
              name: f.call.name,
              arguments: JSON.stringify(f.call.arguments),
            },
          ],
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 'completed',
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [
                { type: 'output_text', text: 'Synthetic completed answer' },
              ],
            },
          ],
        }),
      ),
    );
  const beforeExchange = vi.fn(async () => undefined);
  const onProtocolProgress = vi.fn<
    NonNullable<NodiaAiAdapterRequest['onProtocolProgress']>
  >(async (count, _signal, hidden) =>
    ledger.progress(f.claim, f.context, count, hidden),
  );
  const onToolCall = vi.fn<NonNullable<NodiaAiAdapterRequest['onToolCall']>>(
    async (call) => f.subject.execute(f.claim, f.context, call),
  );
  const request: NodiaAiAdapterRequest = {
    attemptId: f.claim.attempt.id,
    selection: f.run.selection_snapshot,
    canonicalPrompt: 'Synthetic test only',
    resourceKey: 'api-connection:' + 'a'.repeat(64),
    sessionGeneration: 'b'.repeat(32),
    configurationGeneration: 'c'.repeat(64),
    deadlineAt: new Date(Date.now() + 10000),
    tools: await f.subject.descriptors(f.claim, f.context),
    onLeaseCheck: async () => undefined,
    onProtocolProgress,
    onToolCall,
  };
  const answer = await executeApiChat({
    provider: 'openai',
    secret: 'fixture-only-key',
    request,
    policy: f.policy,
    signal: new AbortController().signal,
    beforeExchange,
  });
  expect(answer).toBe('Synthetic completed answer');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(beforeExchange).toHaveBeenCalledTimes(2);
  expect(onToolCall).toHaveBeenCalledOnce();
  expect(f.handler).toHaveBeenCalledOnce();
  expect(f.spent()).toBe(1);
  expect(
    onProtocolProgress.mock.calls.map(([total, , hidden]) => [total, hidden]),
  ).toEqual([
    [1, 0],
    [2, 0],
  ]);
  expect(f.run.context_manifest.mcp_rpc_progress).toEqual({
    [f.claim.attempt.id]: 2,
  });
  const progressReservations = f.query.mock.calls.filter(([sql]) =>
    sql.startsWith(
      'WITH changed AS (UPDATE nodia_ai_runs SET mcp_rpc_messages_used=',
    ),
  );
  expect(
    progressReservations.map(([, parameters]) => parameters?.slice(1)),
  ).toEqual([
    [1, 0],
    [1, 0],
  ]);
});
