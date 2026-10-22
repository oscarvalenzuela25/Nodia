import { describe, expect, it } from 'vitest';
import {
  ListNodiaAiConnectionsUseCase,
  NODIA_AI_CONNECTION_PAGE_UTF8_BYTES,
} from './list-nodia-ai-connections.use-case.js';
import { connectionFixture } from './nodia-ai-connections.fixture.js';
import { testIdentity } from './conversation-admission.fixture.js';

describe('ListNodiaAiConnectionsUseCase', () => {
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
