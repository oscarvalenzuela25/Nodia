import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { ReadNodiaAiAiSettingsUseCase } from './read-ai-settings.use-case.js';
import { createNodiaAiAiSettingsReadFamily } from '../ai-settings-read.family.js';
import { NodiaAiToolRegistryUseCase } from '../../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';
import { Translation } from '../../../translation/entities/translation.entity.js';

function fixture(rows: Record<string, unknown>[]) {
  const qb = {
    getParameters: vi.fn(() => ({})),
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn(async () => [rows, rows.length]),
  };
  const repository = {
    createQueryBuilder: vi.fn(() => qb),
    find: vi.fn(async () => rows),
  };
  const manager = {
    getRepository: vi.fn((entity) =>
      entity === Translation ? { find: async () => [] } : repository,
    ),
  } as unknown as EntityManager;
  const context: NodiaAiToolHandlerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: '3a108baf-2432-4dc2-b05a-48cbba1830f9',
      isSuperAdmin: true,
      modules: [],
    },
    moduleRoutes: ['/ai-providers'],
  };
  const registry = new NodiaAiToolRegistryUseCase(
    [createNodiaAiAiSettingsReadFamily()],
    'synthetic-ai-settings',
  );
  return {
    qb,
    repository,
    manager,
    context,
    registry,
    subject: new ReadNodiaAiAiSettingsUseCase(),
  };
}

describe('ReadNodiaAiAiSettingsUseCase', () => {
  it('returns masked key metadata and exact identity without exposing credentials, errors or relations', async () => {
    const f = fixture([
      {
        id: '9007199254740993',
        provider_id: '2',
        label: 'Synthetic key',
        display_hint: '****1234',
        sort_order: 0,
        is_selected: false,
        is_active: true,
        health_state: 'untested',
        cooldown_until: null,
        last_success_at: null,
        last_error_at: null,
        last_error_code: null,
        secret_ciphertext: 'synthetic-secret',
        secret_fingerprint: 'synthetic-fingerprint',
        last_error_message: 'synthetic-private-error',
        provider: { fields: { api_key: 'synthetic-nested' } },
      },
    ]);
    const result = await f.subject.execute('keys', {}, f.context);
    f.registry.validateOutput(f.registry.get('nodia_api_keys_list')!, result);
    expect(JSON.stringify(result)).not.toMatch(
      /synthetic-secret|synthetic-fingerprint|synthetic-private-error|synthetic-nested/,
    );
    expect(result.data).toMatchObject([
      {
        id: '9007199254740993',
        sort_order: 0,
        is_selected: false,
        cooldown_until: null,
      },
    ]);
    expect(f.qb.take).toHaveBeenCalledWith(25);
    expect(f.qb.addOrderBy).toHaveBeenCalledWith('api_key.id', 'ASC');
    expect(f.qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('api_key.is_active'),
      expect.objectContaining({ ransack_0: true }),
    );
  });
  it('omits the activity predicate for All and uses the same scope for metadata counts', async () => {
    const f = fixture([]);
    const result = await f.subject.execute(
      'events',
      { activity: 'all', limit: 2, page: 3, q: { provider_id_eq: '2' } },
      f.context,
    );
    f.registry.validateOutput(f.registry.get('nodia_ai_events_list')!, result);
    expect(f.qb.skip).toHaveBeenCalledWith(4);
    expect(
      f.qb.andWhere.mock.calls.every(
        ([sql]) => !String(sql).includes('is_active'),
      ),
    ).toBe(true);
    expect(result.meta).toMatchObject({
      page: 3,
      limit: 2,
      total_items: 0,
      total_pages: 0,
    });
  });
  it('preserves inactive selection and excludes arbitrary event message/JSON from the output', async () => {
    const f = fixture([
      {
        id: '1',
        provider_id: '2',
        api_key_id: null,
        actor_user_id: null,
        event_type: 'rotation',
        reason_code: null,
        created_at: new Date('2026-10-16T12:00:00Z'),
        is_active: false,
        message: 'synthetic-token',
        metadata: { secret: 'synthetic-hidden' },
      },
    ]);
    const result = await f.subject.execute(
      'events',
      { activity: 'inactive' },
      f.context,
    );
    f.registry.validateOutput(f.registry.get('nodia_ai_events_list')!, result);
    expect(JSON.stringify(result)).not.toMatch(
      /synthetic-token|synthetic-hidden/,
    );
    expect(f.qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('event.is_active'),
      expect.objectContaining({ ransack_0: false }),
    );
  });
  it('does not present configured modes as authenticated sessions or successful inference', async () => {
    const f = fixture([
      {
        id: '1',
        catalog_id: '2',
        name: null,
        is_active: true,
        is_default: false,
        use_api_key: true,
        use_agentic: false,
        default_mode: null,
        auto_rotate_api_keys: false,
        catalog: { id: '2', key: 'openai' },
        fields: {
          api_key: {
            selected_model: 'synthetic-only',
            secret: 'synthetic-secret',
          },
        },
      },
    ]);
    const result = await f.subject.execute('providers', {}, f.context);
    f.registry.validateOutput(
      f.registry.get('nodia_ai_providers_list')!,
      result,
    );
    expect(JSON.stringify(result)).not.toMatch(
      /synthetic-only|synthetic-secret|authenticated|healthy|inference/,
    );
    expect(result.data).toMatchObject([
      { name: null, default_mode: null, use_api_key: true },
    ]);
  });
  it('rejects unbounded and unexpected tool inputs before they reach a domain port', () => {
    const f = fixture([]),
      tool = f.registry.get('nodia_ai_providers_list')!;
    for (const input of [
      { all: true },
      { limit: 101 },
      { page: 0 },
      { q: { secret_eq: 'x' } },
      { activity: 'unknown' },
      { actor_id: '1' },
      { q: { name_cont: 'x'.repeat(257) } },
    ])
      expect(() => f.registry.validateInput(tool, input)).toThrow(
        'invalid_tool_input',
      );
    expect(f.repository.createQueryBuilder).not.toHaveBeenCalled();
  });
  it('rejects an oversized catalogue rather than returning a truncated successful result', async () => {
    const f = fixture(
      Array.from({ length: 101 }, (_, index) => ({
        id: String(index + 1),
        key: 'synthetic',
      })),
    );
    await expect(f.subject.execute('catalog', {}, f.context)).rejects.toThrow(
      'context_limit',
    );
    expect(f.repository.find).toHaveBeenCalledWith({
      order: { id: 'ASC' },
      take: 101,
    });
  });
  it('propagates database failures rather than inventing an empty catalogue', async () => {
    const f = fixture([]);
    f.qb.getManyAndCount.mockRejectedValueOnce(
      new Error('synthetic-database-down'),
    );
    await expect(f.subject.execute('events', {}, f.context)).rejects.toThrow(
      'synthetic-database-down',
    );
  });
});
