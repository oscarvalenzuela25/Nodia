import { describe, expect, it } from 'vitest';
import {
  ListNodiaAiConnectionsUseCase,
  NODIA_AI_CONNECTION_PAGE_UTF8_BYTES,
} from './list-nodia-ai-connections.use-case.js';
import { connectionFixture } from './nodia-ai-connections.fixture.js';
import { testIdentity } from './conversation-admission.fixture.js';

describe('ListNodiaAiConnectionsUseCase', () => {
  it('keeps OpenAI Agentic tools unknown until an independent live observation and leaves Web/API unsupported', async () => {
    const f = connectionFixture();
    f.row.provider_key = 'openai';
    const result = await new ListNodiaAiConnectionsUseCase(
      f.connections,
      f.authorize,
      f.policy,
    ).execute(testIdentity, {});
    const item = result.items[0];
    expect(
      item.modes.find((mode) => mode.mode === 'token_plan_agentic'),
    ).toMatchObject({
      tools: 'unknown',
      authentication: 'unknown',
      inference: 'unknown',
      observed_at: null,
    });
    expect(
      item.modes
        .filter((mode) => mode.mode !== 'token_plan_agentic')
        .map((mode) => mode.tools),
    ).toEqual(['unsupported', 'unsupported']);
    expect(f.transport.observe).not.toHaveBeenCalled();
  });
  it('projects only discovered Codex efforts per model without static options or unsupported saved preferences', async () => {
    const f = connectionFixture();
    f.row.provider_key = 'openai';
    f.row.fields = {
      token_plan_agentic: {
        selected_model: 'synthetic-codex-one',
        thinking_level: 'historical-unsupported',
        thinking_levels: { 'synthetic-codex-two': 'other-unsupported' },
        available_models: [
          {
            id: 'synthetic-codex-one',
            supportedReasoningEfforts: [
              'future_effort',
              'minimal',
              'future_effort',
            ],
            secret: 'synthetic-never-public',
          },
          {
            id: 'synthetic-codex-two',
            supportedReasoningEfforts: ['second_effort'],
          },
        ],
      },
    };
    const result = await new ListNodiaAiConnectionsUseCase(
      f.connections,
      f.authorize,
      f.policy,
    ).execute(testIdentity, {});
    const mode = result.items[0].modes[2];
    expect(mode.configured_selection?.effort_id).toBe('historical-unsupported');
    expect(mode.models).toEqual([
      {
        model_id: 'synthetic-codex-one',
        label: 'synthetic-codex-one',
        efforts: [
          { effort_id: 'future_effort', label: 'future_effort' },
          { effort_id: 'minimal', label: 'minimal' },
        ],
      },
      {
        model_id: 'synthetic-codex-two',
        label: 'synthetic-codex-two',
        efforts: [{ effort_id: 'second_effort', label: 'second_effort' }],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('synthetic-never-public');
    expect(f.transport.observe).not.toHaveBeenCalled();
  });
  it.each([
    undefined,
    null,
    'future_effort',
    { future_effort: true },
    ['future_effort', 1],
    ['future_effort', ''],
    ['future_effort', 'x'.repeat(33)],
    [{ reasoningEffort: 'future_effort' }],
  ])(
    'does not fabricate Codex efforts from missing or malformed saved discovery %j',
    async (supportedReasoningEfforts) => {
      const f = connectionFixture();
      f.row.provider_key = 'openai';
      f.row.fields = {
        token_plan_agentic: {
          selected_model: 'synthetic-codex',
          thinking_level: 'historical-effort',
          available_models: [
            { id: 'synthetic-codex', supportedReasoningEfforts },
          ],
        },
      };
      const result = await new ListNodiaAiConnectionsUseCase(
        f.connections,
        f.authorize,
        f.policy,
      ).execute(testIdentity, {});
      expect(result.items[0].modes[2]).toMatchObject({
        configured_selection: { effort_id: 'historical-effort' },
        models: [{ model_id: 'synthetic-codex', efforts: [] }],
        authentication: 'unknown',
        inference: 'unknown',
        tools: 'unknown',
      });
    },
  );
  it('preserves an orphaned Codex model and explicit null effort without inventing a catalog', async () => {
    const f = connectionFixture();
    f.row.provider_key = 'openai';
    f.row.fields = {
      token_plan_agentic: {
        selected_model: 'synthetic-historical',
        thinking_levels: { 'synthetic-historical': null },
        thinking_level: 'historical-general',
      },
    };
    const result = await new ListNodiaAiConnectionsUseCase(
      f.connections,
      f.authorize,
      f.policy,
    ).execute(testIdentity, {});
    expect(result.items[0].modes[2]).toMatchObject({
      configured_selection: {
        model_id: 'synthetic-historical',
        effort_id: null,
      },
      models: [{ model_id: 'synthetic-historical', efforts: [] }],
    });
  });
  it('does not project Codex effort metadata into OpenAI API or Web modes', async () => {
    const f = connectionFixture();
    f.row.provider_key = 'openai';
    const fields = {
      selected_model: 'synthetic-mode-specific',
      available_models: [
        {
          id: 'synthetic-mode-specific',
          supportedReasoningEfforts: ['future_effort'],
        },
      ],
    };
    f.row.fields = {
      api_key: fields,
      token_plan_web: fields,
      token_plan_agentic: fields,
    };
    const result = await new ListNodiaAiConnectionsUseCase(
      f.connections,
      f.authorize,
      f.policy,
    ).execute(testIdentity, {});
    expect(result.items[0].modes.map((mode) => mode.models[0].efforts)).toEqual(
      [[], [], [{ effort_id: 'future_effort', label: 'future_effort' }]],
    );
  });
  it('rejects an oversized Codex effort catalog instead of silently truncating it', async () => {
    const f = connectionFixture();
    f.row.provider_key = 'openai';
    f.row.fields = {
      token_plan_agentic: {
        available_models: [
          {
            id: 'synthetic-codex',
            supportedReasoningEfforts: Array.from(
              { length: 33 },
              (_, index) => `synthetic_${index}`,
            ),
          },
        ],
      },
    };
    await expect(
      new ListNodiaAiConnectionsUseCase(
        f.connections,
        f.authorize,
        f.policy,
      ).execute(testIdentity, {}),
    ).rejects.toThrow('nodia_ai:connection_catalog_too_large');
  });
  it('preserves Gemini configurable effort preferences independently of Codex discovery metadata', async () => {
    const f = connectionFixture();
    f.row.fields = {
      token_plan_agentic: {
        selected_model: 'synthetic-gemini',
        thinking_level: 'synthetic-preferred',
        available_models: [
          {
            id: 'synthetic-gemini',
            supportedReasoningEfforts: ['codex-only-effort'],
          },
        ],
      },
    };
    const result = await new ListNodiaAiConnectionsUseCase(
      f.connections,
      f.authorize,
      f.policy,
    ).execute(testIdentity, {});
    expect(
      result.items[0].modes[2].models[0].efforts.map(
        (option) => option.effort_id,
      ),
    ).toEqual(['low', 'medium', 'high', 'synthetic-preferred']);
    expect(result.items[0].modes[2].configured_selection?.effort_id).toBe(
      'synthetic-preferred',
    );
    expect(result.items[0].modes[2].tools).toBe('unknown');
  });
  it('pages by UTF-8 response bytes between whole connections without skipping rows', async () => {
    const f = connectionFixture();
    const largeFields = {
      token_plan_web: {
        available_models: Array.from({ length: 200 }, (_, index) => ({
          id: `synthetic-${index}`,
          name: 'á'.repeat(500),
        })),
      },
    };
    f.storage.list.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, index) => ({
        ...f.row,
        id: String(index + 2),
        fields: largeFields,
      })),
    );
    const subject = new ListNodiaAiConnectionsUseCase(
      f.connections,
      f.authorize,
      f.policy,
    );
    const result = await subject.execute(testIdentity, { page_limit: 10 });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThan(10);
    expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThan(
      NODIA_AI_CONNECTION_PAGE_UTF8_BYTES,
    );
    await subject.execute(testIdentity, {
      page_limit: 10,
      cursor: result.next_cursor,
    });
    expect(f.storage.list).toHaveBeenLastCalledWith(
      f.manager,
      result.items.at(-1)!.connection_id,
      10,
    );
  });
  it('rejects a single connection exceeding the page byte budget explicitly', async () => {
    const f = connectionFixture();
    const mode = {
      available_models: Array.from({ length: 200 }, (_, index) => ({
        id: `${'x'.repeat(1000)}-${index}`,
        name: 'á'.repeat(500),
      })),
    };
    f.row.fields = {
      api_key: mode,
      token_plan_web: mode,
      token_plan_agentic: mode,
    };
    await expect(
      new ListNodiaAiConnectionsUseCase(
        f.connections,
        f.authorize,
        f.policy,
      ).execute(testIdentity, {}),
    ).rejects.toThrow('nodia_ai:connection_catalog_too_large');
  });
  it('rejects oversized saved catalogs explicitly rather than hiding later models', async () => {
    const f = connectionFixture();
    f.row.fields = {
      token_plan_web: {
        available_models: Array.from({ length: 201 }, (_, index) => ({
          id: `synthetic-${index}`,
        })),
      },
    };
    await expect(
      new ListNodiaAiConnectionsUseCase(
        f.connections,
        f.authorize,
        f.policy,
      ).execute(testIdentity, {}),
    ).rejects.toThrow('nodia_ai:connection_catalog_too_large');
  });
  it('permits assigned NodiaAI users without Settings or ai:manage and projects no secret fields', async () => {
    const f = connectionFixture();
    const subject = new ListNodiaAiConnectionsUseCase(
      f.connections,
      f.authorize,
      f.policy,
    );
    const result = await subject.execute(testIdentity, {});
    expect(result.items[0].connection_id).toBe('2');
    expect(result.items[0].modes[1]).toMatchObject({
      configuration: 'configured',
      authentication: 'unknown',
      inference: 'unknown',
      tools: 'unsupported',
      observed_at: null,
    });
    expect(JSON.stringify(result)).not.toContain('synthetic-never-public');
    expect(result.items[0]).not.toHaveProperty('fields');
    expect(
      result.items[0].modes[1].models[0].efforts.map(
        (option) => option.effort_id,
      ),
    ).toEqual(['low', 'medium', 'high']);
    expect(f.transport.observe).not.toHaveBeenCalled();
  });
  it('never promotes inactive gates to configured or supplies a phantom model', async () => {
    const f = connectionFixture();
    f.row.can_use_token_plan_web = false;
    f.row.fields = {
      token_plan_web: {},
      token_plan_agentic: {
        selected_model: 'synthetic-other',
        thinking_levels: { 'synthetic-other': null },
        thinking_level: 'synthetic-general',
      },
    };
    const result = await new ListNodiaAiConnectionsUseCase(
      f.connections,
      f.authorize,
      f.policy,
    ).execute(testIdentity, {});
    expect(result.items[0].modes[1]).toMatchObject({
      configuration: 'disabled',
      configured_selection: null,
      models: [],
    });
    expect(result.items[0].modes[2].configured_selection?.effort_id).toBeNull();
  });
  it('rejects revoked assignment before reading connections', async () => {
    const f = connectionFixture();
    f.snapshot.modules[0].assigned = false;
    await expect(
      new ListNodiaAiConnectionsUseCase(
        f.connections,
        f.authorize,
        f.policy,
      ).execute(testIdentity, {}),
    ).rejects.toMatchObject({ status: 403 });
    expect(f.storage.list).not.toHaveBeenCalled();
  });
  it('binds bounded bigint pagination to identity/session', async () => {
    const f = connectionFixture();
    f.storage.list.mockResolvedValueOnce([
      f.row,
      { ...f.row, id: '9007199254740993' },
    ]);
    const subject = new ListNodiaAiConnectionsUseCase(
      f.connections,
      f.authorize,
      f.policy,
    );
    const first = await subject.execute(testIdentity, { page_limit: 1 });
    await subject.execute(testIdentity, {
      page_limit: 1,
      cursor: first.next_cursor,
    });
    expect(f.storage.list).toHaveBeenLastCalledWith(f.manager, '2', 1);
    const other = {
      ...testIdentity,
      sessionId: '8d524fcc-68dd-4c62-a183-6cf3baedc6d2',
    };
    f.snapshot.sessionId = other.sessionId;
    await expect(
      subject.execute(other, { cursor: first.next_cursor }),
    ).rejects.toThrow('nodia_ai:invalid_cursor');
  });
  it.each([
    { page_limit: 101 },
    { page_limit: '1e2' },
    { all: true },
    { cursor: null },
  ])('rejects invalid query %j', async (input) => {
    const f = connectionFixture();
    await expect(
      new ListNodiaAiConnectionsUseCase(
        f.connections,
        f.authorize,
        f.policy,
      ).execute(testIdentity, input),
    ).rejects.toMatchObject({ status: 400 });
    expect(f.storage.list).not.toHaveBeenCalled();
  });
});
