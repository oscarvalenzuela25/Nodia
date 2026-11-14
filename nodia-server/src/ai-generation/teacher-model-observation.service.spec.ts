import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import { NodiaAiConnectionsService, type NodiaAiConnectionConfiguration } from '../nodia-ai-conversation/nodia-ai-connections.service.js';
import type { CodexRuntimeService } from '../common/ai/codex/codex-runtime.service.js';
import { codexError } from '../common/ai/codex/codex-contract.js';
import { TeacherModelObservationService } from './teacher-model-observation.service.js';

const actor = { userId: '7', sessionId: '11111111-1111-4111-8111-111111111111' };
const model = (id = 'fixture-model', efforts: unknown = ['future_effort', 'other_effort']) => ({ id, displayName: `Label ${id}`, supportedReasoningEfforts: efforts });
const sparseEfforts: unknown[] = [];
sparseEfforts.length = 2;

function fixture() {
  let active = true, allowed = true, inTransaction = false;
  const row: NodiaAiConnectionConfiguration = {
    id: '5', label: 'Fixture connection', provider_key: 'openai', is_active: true, is_default: false,
    default_mode: 'agentic', catalog_active: true, use_api_key: false, use_agentic: true,
    can_use_api_key: true, can_use_agentic: true, configuration_updated_at: '2026-11-14T00:00:00Z',
    fields: { agentic: { selected_model: 'fixture-model', thinking_level: 'retired_effort', available_models: [{ id: 'fixture-model' }] } },
  };
  const queries: string[] = [];
  const query = vi.fn(async (sql: string) => {
    queries.push(sql);
    if (sql.includes('AS "actorId"')) return active ? [{ actorId: actor.userId, sessionId: actor.sessionId, isSuperAdmin: false }] : [];
    if (sql.includes('AS actor_active')) return [{ actor_active: active, allowed }];
    if (sql.includes('FROM ai_providers p')) return [structuredClone(row)];
    return [];
  });
  const manager = { query } as unknown as EntityManager;
  const source = { transaction: vi.fn(async (work: (manager: EntityManager) => Promise<unknown>) => {
    inTransaction = true;
    try { return await work(manager); } finally { inTransaction = false; }
  }) } as unknown as DataSource;
  const listModels = vi.fn(async (_id: string, _signal?: AbortSignal): Promise<unknown> => {
    expect(inTransaction).toBe(false);
    return [model(), model('unconfigured-model')];
  });
  const service = new TeacherModelObservationService(source, new CheckModuleAccessUseCase(source),
    new NodiaAiConnectionsService(source), { listModels } as unknown as CodexRuntimeService);
  return { service, row, query, queries, source, listModels,
    deactivate: () => { active = false; }, revoke: () => { allowed = false; } };
}

describe('Teacher live model observation', () => {
  it('recovers real effort options for a historical selection without activating models or inferring', async () => {
    const f = fixture(); const original = structuredClone(f.row);
    expect(await f.service.execute(actor, '5', 'agentic')).toEqual({ connection_id: '5', mode: 'agentic', models: [
      { model_id: 'fixture-model', label: 'Label fixture-model', efforts: [
        { effort_id: 'future_effort', label: 'future_effort' }, { effort_id: 'other_effort', label: 'other_effort' },
      ] },
    ] });
    expect(f.listModels).toHaveBeenCalledExactlyOnceWith('5', expect.any(AbortSignal));
    expect(f.source.transaction).toHaveBeenCalledTimes(2);
    expect(f.queries.filter(sql => sql.includes('WITH actor AS'))).toHaveLength(2);
    expect(f.queries.filter(sql => sql.includes('FROM ai_providers p'))).toHaveLength(2);
    expect(f.queries.some(sql => /UPDATE|INSERT|DELETE/.test(sql))).toBe(false);
    expect(f.row).toEqual(original);
  });

  it.each(['session', 'module', 'connection', 'catalog', 'mode', 'provider'])("rejects unavailable %s before native I/O", async kind => {
    const f = fixture();
    if (kind === 'session') f.deactivate();
    if (kind === 'module') f.revoke();
    if (kind === 'connection') f.row.is_active = false;
    if (kind === 'catalog') f.row.catalog_active = false;
    if (kind === 'provider') f.row.provider_key = 'gemini';
    await expect(f.service.execute(actor, '5', kind === 'mode' ? 'api_key' : 'agentic')).rejects.toMatchObject({
      status: kind === 'session' ? 401 : kind === 'module' ? 403 : kind === 'mode' || kind === 'provider' ? 400 : 503,
    });
    expect(f.listModels).not.toHaveBeenCalled();
  });

  it.each(['session', 'module', 'configuration', 'generation'])("rejects a changed %s after native I/O", async kind => {
    const f = fixture();
    f.listModels.mockImplementationOnce(async () => {
      if (kind === 'session') f.deactivate();
      if (kind === 'module') f.revoke();
      if (kind === 'configuration') f.row.fields = { agentic: { selected_model: 'different-model' } };
      if (kind === 'generation') f.row.configuration_updated_at = '2026-11-14T00:00:01Z';
      return [model()];
    });
    await expect(f.service.execute(actor, '5', 'agentic')).rejects.toMatchObject({ status: kind === 'session' ? 401 : kind === 'module' ? 403 : 409 });
    expect(f.listModels).toHaveBeenCalledOnce();
  });

  it.each([undefined, null, {}, [{ id: 'fixture-model' }], [model('fixture-model', [42])],
    [model('fixture-model', sparseEfforts)], [model('fixture-model', Array(33).fill('effort'))], [model(), model()]].map(invalid => ({ invalid })))(
    'rejects invalid native catalogs without manufacturing effort options', async ({ invalid }) => {
      const f = fixture(); f.listModels.mockResolvedValueOnce(invalid);
      await expect(f.service.execute(actor, '5', 'agentic')).rejects.toMatchObject({ status: 502 });
    },
  );

  it('distinguishes an absent live model from a live model with no efforts', async () => {
    const f = fixture(); f.listModels.mockResolvedValueOnce([]);
    expect((await f.service.execute(actor, '5', 'agentic')).models).toEqual([]);
    f.listModels.mockResolvedValueOnce([model('fixture-model', [])]);
    expect((await f.service.execute(actor, '5', 'agentic')).models).toEqual([
      { model_id: 'fixture-model', label: 'Label fixture-model', efforts: [] },
    ]);
  });

  it('includes an explicitly selected orphan only if its exact ID remains in the live catalog', async () => {
    const f = fixture(); f.row.fields = { agentic: { selected_model: 'fixture-model', available_models: [] } };
    expect((await f.service.execute(actor, '5', 'agentic')).models.map(item => item.model_id)).toEqual(['fixture-model']);
  });

  it('retains 200 configured models and one selected orphan without truncating the response', async () => {
    const f = fixture(); const saved = Array.from({ length: 200 }, (_, index) => ({ id: `fixture-${index}` }));
    f.row.fields = { agentic: { selected_model: 'fixture-model', available_models: saved } };
    f.listModels.mockResolvedValueOnce([...saved.map(item => model(item.id)), model()]);
    const observed = await f.service.execute(actor, '5', 'agentic');
    expect(observed.models).toHaveLength(201);
    expect(observed.models.at(-1)?.model_id).toBe('fixture-model');
    f.row.fields = { agentic: { available_models: [...saved, { id: 'fixture-201' }] } };
    await expect(f.service.execute(actor, '5', 'agentic')).rejects.toMatchObject({ status: 503 });
    expect(f.listModels).toHaveBeenCalledOnce();
  });

  it('returns a safe unavailable response on native failure without leaking provider output', async () => {
    const f = fixture(); f.listModels.mockRejectedValueOnce(new Error('private provider output'));
    await expect(f.service.execute(actor, '5', 'agentic')).rejects.toMatchObject({ status: 503, message: 'teacher:provider_unavailable' });
    expect(f.source.transaction).toHaveBeenCalledOnce();
  });

  it('classifies a rejected native catalog parser as invalid metadata instead of availability', async () => {
    const f = fixture(); f.listModels.mockRejectedValueOnce(codexError('codex_protocol_invalid', 502));
    await expect(f.service.execute(actor, '5', 'agentic')).rejects.toMatchObject({ status: 502, message: 'teacher:model_observation_invalid' });
    expect(f.listModels).toHaveBeenCalledOnce();
  });

  it('propagates caller cancellation into the single native observation', async () => {
    const f = fixture(); const cancellation = new AbortController();
    f.listModels.mockImplementationOnce(async (_id, signal) => {
      cancellation.abort();
      expect(signal?.aborted).toBe(true);
      signal?.throwIfAborted();
      return [];
    });
    await expect(f.service.execute(actor, '5', 'agentic', cancellation.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.listModels).toHaveBeenCalledOnce();
    expect(f.source.transaction).toHaveBeenCalledOnce();
  });

  it('turns its bounded observation deadline into a safe timeout without retry', async () => {
    const f = fixture(); const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValueOnce(deadline.signal);
    f.listModels.mockImplementationOnce(async (_id, signal) => {
      deadline.abort();
      signal?.throwIfAborted();
      return [];
    });
    try {
      await expect(f.service.execute(actor, '5', 'agentic')).rejects.toMatchObject({ status: 503, message: 'teacher:model_observation_timeout' });
      expect(timeout).toHaveBeenCalledWith(30000);
      expect(f.listModels).toHaveBeenCalledOnce();
      expect(f.source.transaction).toHaveBeenCalledOnce();
    } finally { timeout.mockRestore(); }
  });

  it('does not read authority or acquire a profile after caller cancellation', async () => {
    const f = fixture(); const caller = new AbortController(); caller.abort();
    await expect(f.service.execute(actor, '5', 'agentic', caller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(f.listModels).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '5::bigint', '9223372036854775808'])('rejects malformed connection identity %s before reading authority', async id => {
    const f = fixture();
    await expect(f.service.execute(actor, id, 'agentic')).rejects.toMatchObject({ status: 400 });
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(f.listModels).not.toHaveBeenCalled();
  });
});
