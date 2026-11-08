import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { EntityManager } from 'typeorm';
import { RentalTransactionService } from '../../../rental-common/rental-transaction.service.js';
import { RentalClock } from '../../../rental-common/rental-clock.js';
import { RentalProperty } from '../../../rental-property/entities/rental-property.entity.js';
import { RentalCollaborator } from '../../../rental-collaborator/entities/rental-collaborator.entity.js';
import { GetRentalPropertyUseCase } from '../../../rental-property/use-case/get-rental-property.use-case.js';
import { GetRentalPropertiesUseCase } from '../../../rental-property/use-case/get-rental-properties.use-case.js';
import { RentalPropertyService } from '../../../rental-property/rental-property.service.js';
import { NodiaAiToolRegistryUseCase } from '../../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { NodiaAiToolHandlerContext } from '../../../nodia-ai-tools/types/tool-registry.types.js';
import { NodiaAiReservationsFamilyUseCase } from './nodia-ai-reservations-family.use-case.js';
import { canonicalModuleRoute } from '../../../authorization/canonical-module-route.js';

function fixture() {
  let collaborator = true;
  let superAdmin = false;
  let session = true;
  const property = {
    id: '2',
    owner_id: '9',
    name: 'Casa prueba',
    location: null,
    timezone: 'America/Santiago',
    max_guests: 4,
    check_in_time: '15:00:00',
    check_out_time: '11:00:00',
    default_nightly_rate: '9007199254740993',
    default_deposit_percent: '25.00',
    minimum_turnover_minutes: 60,
    default_cancellation_policy_id: null,
    notes: null,
    is_active: true,
    created_by: '9',
    updated_by: '9',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-02T00:00:00Z'),
  };
  const driverQuery = vi.fn(async (sql: string) =>
    sql.startsWith('SELECT u.id')
      ? session
        ? [
            {
              actorId: '1',
              sessionId: '11111111-1111-4111-8111-111111111111',
              isSuperAdmin: superAdmin,
            },
          ]
        : []
      : sql.startsWith('SELECT p.id::text') && (collaborator || superAdmin)
        ? [{ id: '2', owner_id: '9' }]
        : [],
  );
  const runner = { isTransactionActive: true, query: driverQuery };
  const manager = {
    queryRunner: runner,
    query: vi.fn((...args: Parameters<typeof driverQuery>) =>
      runner.query(...args),
    ),
    getRepository: vi.fn((entity: unknown) =>
      entity === RentalProperty
        ? {
            findOne: vi.fn(async ({ where }: { where: { id: string } }) =>
              where.id === '2' ? property : null,
            ),
          }
        : entity === RentalCollaborator
          ? { existsBy: vi.fn(async () => collaborator) }
          : {
              findOne: vi.fn(async () => ({ id: '1' })),
              existsBy: vi.fn(async () => true),
            },
    ),
  } as unknown as EntityManager;
  const transactions = new RentalTransactionService(
    {
      createQueryRunner: () => {
        throw new Error('Separate transaction forbidden');
      },
    } as never,
    new RentalClock(),
  );
  const ports = Array.from({ length: 21 }, () => ({
    execute: vi.fn(async () => ({})),
  }));
  const propertyUseCase = new GetRentalPropertyUseCase(transactions);
  ports[13] = propertyUseCase as unknown as (typeof ports)[number];
  ports[14] = new GetRentalPropertiesUseCase(
    transactions,
    new RentalPropertyService(),
  ) as unknown as (typeof ports)[number];
  const policy = { results: { list_default_rows: 25, list_max_rows: 100 } };
  const dependencies = [
    transactions,
    ...ports,
    policy,
  ] as unknown as ConstructorParameters<
    typeof NodiaAiReservationsFamilyUseCase
  >;
  const family = new NodiaAiReservationsFamilyUseCase(...dependencies).family();
  const registry = new NodiaAiToolRegistryUseCase([family], 'test_catalog');
  const context: NodiaAiToolHandlerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: '11111111-1111-4111-8111-111111111111',
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/reservations'],
  };
  return {
    family,
    registry,
    context,
    driverQuery,
    ports,
    property,
    revoke: () => {
      collaborator = false;
    },
    makeAdmin: () => {
      superAdmin = true;
    },
    expire: () => {
      session = false;
    },
  };
}

describe('NodiaAiReservationsFamilyUseCase', () => {
  it.each([
    [3000, "SET LOCAL statement_timeout = '3000ms'"],
    [7000, "SET LOCAL statement_timeout = '5000ms'"],
    [undefined, "SET LOCAL statement_timeout = '5s'"],
  ])(
    'preserves the internal %s SQL ceiling through native authority without a SELECT before LOCK',
    async (timeout, expected) => {
      const f = fixture();
      const tool = f.family.capabilities.find(
        (item) => item.toolName === 'nodia_rental_properties_get',
      )!;
      const context = { ...f.context, statementTimeoutMs: timeout };
      await tool.verifyAuthority({ property_id: '2' }, context);
      const result = await tool.handler({ property_id: '2' }, context);
      await tool.verifyResultAuthority!({ property_id: '2' }, result, context);
      const statements = vi
        .mocked(f.context.manager.query)
        .mock.calls.map(([sql]) => String(sql));
      expect(
        statements.filter((sql) =>
          sql.startsWith('SET LOCAL statement_timeout'),
        ),
      ).toEqual([expected, expected, expected]);
      expect(
        statements.findIndex((sql) => sql.startsWith('SELECT')),
      ).toBeGreaterThan(
        statements.findIndex((sql) => sql.startsWith('LOCK TABLE')),
      );
      expect(
        statements
          .slice(
            0,
            statements.findIndex((sql) => sql.startsWith('LOCK TABLE')),
          )
          .every((sql) => sql.startsWith('SET LOCAL')),
      ).toBe(true);
      const nativeStatements = f.driverQuery.mock.calls.map(([sql]) => sql);
      const ceiling = Math.min(5000, timeout ?? 5000);
      const nativeTimeouts = nativeStatements.flatMap((sql) => {
        const match = /^SET LOCAL statement_timeout = '(\d+)(ms|s)'$/.exec(sql);
        return match ? [Number(match[1]) * (match[2] === 's' ? 1000 : 1)] : [];
      });
      expect(nativeTimeouts.length).toBeGreaterThan(3);
      expect(
        nativeTimeouts.every((value) => value > 0 && value <= ceiling),
      ).toBe(true);
      expect(
        nativeStatements.findIndex((sql) => sql.startsWith('SELECT')),
      ).toBeGreaterThan(
        nativeStatements.findIndex((sql) => sql.startsWith('LOCK TABLE')),
      );
      expect(f.context.manager.queryRunner?.query).toBe(f.driverQuery);
    },
  );
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects malformed internal timeout %s before a database operation',
    async (timeout) => {
      const f = fixture();
      const tool = f.family.capabilities.find(
        (item) => item.toolName === 'nodia_rental_properties_get',
      )!;
      await expect(
        tool.verifyAuthority(
          { property_id: '2' },
          { ...f.context, statementTimeoutMs: timeout },
        ),
      ).rejects.toThrow('authorization:statement_timeout');
      expect(f.context.manager.query).not.toHaveBeenCalled();
    },
  );
  it('covers exactly all 21 catalogued read operations without writes or operation recovery', () => {
    const { family } = fixture();
    const catalog = JSON.parse(
      readFileSync(
        new URL(
          '../../../../../docs/mvp/nodia-ai-v1-tool-catalog.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as {
      domainTools: { name: string; targetModuleRoute: string; kind: string }[];
    };
    const expected = catalog.domainTools
      .filter(
        (tool) =>
          canonicalModuleRoute(tool.targetModuleRoute) === '/reservations' &&
          tool.kind === 'read',
      )
      .map((tool) => tool.name)
      .sort();
    expect(family.capabilities.map((tool) => tool.toolName).sort()).toEqual(
      expected,
    );
    expect(family.capabilities).toHaveLength(21);
    expect(
      family.capabilities.every(
        (tool) =>
          tool.kind === 'read' &&
          tool.effectKey === 'read' &&
          tool.capabilityId === tool.toolName &&
          tool.requiredModuleRoutes.join() === '/reservations',
      ),
    ).toBe(true);
    expect(
      family.capabilities.some((tool) =>
        /prepare_|operations/.test(tool.toolName),
      ),
    ).toBe(false);
  });
  it('reads through the original use case using the inherited manager, preserving bigint money and public projection', async () => {
    const { family, context, registry } = fixture();
    const tool = family.capabilities.find(
      (tool) => tool.toolName === 'nodia_rental_properties_get',
    )!;
    const result = await tool.handler({ property_id: '2' }, context);
    registry.validateOutput(registry.get(tool.toolName)!, result);
    expect(result.default_nightly_rate).toBe('9007199254740993');
    expect(result.membership).toEqual({
      type: 'collaborator',
      can_manage_configuration: false,
      can_manage_collaborators: false,
    });
    expect(context.manager.getRepository).toHaveBeenCalledWith(RentalProperty);
  });
  it('revalidates collaboration for every replay, hides another property and never trusts the actor role snapshot', async () => {
    const f = fixture();
    const tool = f.family.capabilities.find(
      (tool) => tool.toolName === 'nodia_rental_properties_get',
    )!;
    await tool.verifyAuthority({ property_id: '2' }, f.context);
    f.revoke();
    await expect(
      tool.verifyAuthority({ property_id: '2' }, f.context),
    ).rejects.toThrow('rental:not_found');
    await expect(
      tool.verifyAuthority({ property_id: '3' }, f.context),
    ).rejects.toThrow('rental:not_found');
    f.makeAdmin();
    await expect(
      tool.verifyAuthority({ property_id: '2' }, f.context),
    ).resolves.toBeUndefined();
    const result = await tool.handler({ property_id: '2' }, f.context);
    expect(result.membership).toEqual({
      type: 'super_admin',
      can_manage_configuration: true,
      can_manage_collaborators: true,
    });
    expect(result.owner_id).toBe('9');
  });
  it('candidate search requires owner or current super_admin; session expiry and cancellation stop reads', async () => {
    const f = fixture();
    const tool = f.family.capabilities.find(
      (tool) => tool.toolName === 'nodia_rental_collaborators_candidates',
    )!;
    await expect(
      tool.verifyAuthority({ property_id: '2' }, f.context),
    ).rejects.toThrow('rental:owner_required');
    f.makeAdmin();
    await expect(
      tool.verifyAuthority({ property_id: '2' }, f.context),
    ).resolves.toBeUndefined();
    f.expire();
    await expect(
      tool.verifyAuthority({ property_id: '2' }, f.context),
    ).rejects.toThrow('auth:session_expired');
    const controller = new AbortController();
    controller.abort();
    await expect(
      tool.verifyAuthority(
        { property_id: '2' },
        { ...f.context, signal: controller.signal },
      ),
    ).rejects.toThrow('nodia_ai:tool_cancelled');
  });
  it('revalidates all property IDs and membership flags in a stored page after collaboration or role revocation', async () => {
    const f = fixture();
    const list = f.family.capabilities.find(
      (tool) => tool.toolName === 'nodia_rental_properties_list',
    )!;
    const get = f.family.capabilities.find(
      (tool) => tool.toolName === 'nodia_rental_properties_get',
    )!;
    const result = await get.handler({ property_id: '2' }, f.context);
    await list.verifyResultAuthority!({}, { data: [result] }, f.context);
    expect(f.context.manager.query).toHaveBeenCalledWith(
      expect.stringContaining('p.id=ANY($2::bigint[])'),
      ['1', ['2'], false],
    );
    f.revoke();
    await expect(
      list.verifyResultAuthority!({}, { data: [result] }, f.context),
    ).rejects.toThrow('rental:not_found');
    f.makeAdmin();
    // A surviving module/session does not make stale role flags valid.
    await expect(
      list.verifyResultAuthority!({}, { data: [result] }, f.context),
    ).rejects.toThrow('rental:not_found');
    const admin = await get.handler({ property_id: '2' }, f.context);
    await expect(
      list.verifyResultAuthority!({}, { data: [admin] }, f.context),
    ).resolves.toBeUndefined();
  });
  it.each([
    ['nodia_rental_reservations_list', { property_id: '2', user_id: '9' }],
    [
      'nodia_rental_reservations_list',
      { property_id: '2', query: { limit: 101 } },
    ],
    [
      'nodia_rental_reservations_list',
      { property_id: '2', query: { q: { owner_id_eq: '9' } } },
    ],
    [
      'nodia_rental_reservations_list',
      { property_id: '2', query: { q: { s: 'guest_contact desc' } } },
    ],
    [
      'nodia_rental_reservations_list',
      { property_id: '2', query: { from_on: '2026-01-01' } },
    ],
    [
      'nodia_rental_blocks_list',
      { property_id: '2', query: { starts_at: '2026-01-01T00:00:00Z' } },
    ],
    [
      'nodia_rental_calendar_calendar',
      {
        property_id: '2',
        query: { from_on: '2026-02-30', to_on: '2026-03-01' },
      },
    ],
    [
      'nodia_rental_collaborators_candidates',
      { property_id: '2', query: { search: 'ab', limit: 21 } },
    ],
    [
      'nodia_rental_payments_list',
      { property_id: '2', query: { active: 'all' } },
    ],
    ['nodia_rental_expenses_get', { property_id: 2, id: '3' }],
    [
      'nodia_rental_reservations_cancellation_preview',
      {
        property_id: '2',
        id: '3',
        command: {
          cancelled_at: '2026-01-01T00:00:00Z',
          expected_refund_amount: '2',
        },
      },
    ],
  ])('rejects invalid or unauthorized filters for %s', (name, input) => {
    const { registry } = fixture();
    expect(() => registry.validateInput(registry.get(name)!, input)).toThrow();
  });
  it('offers bounded filter combinations and refuses an open nested output payload', () => {
    const { registry } = fixture();
    expect(() =>
      registry.validateInput(registry.get('nodia_rental_expenses_list')!, {
        property_id: '2',
        query: {
          page: 1,
          limit: 100,
          status: 'paid',
          category: 'food',
          from_on: '2026-01-01',
          to_on: '2026-01-31',
          q: { name_cont: 'Compra', s: 'incurred_on desc' },
        },
      }),
    ).not.toThrow();
    expect(() =>
      registry.validateOutput(registry.get('nodia_rental_properties_get')!, {
        id: '2',
        credentials: { key: 'private' },
      }),
    ).toThrow();
  });
  it('applies policy defaults and refuses oversized windows without truncating', async () => {
    const f = fixture();
    const list = f.family.capabilities.find(
      (t) => t.toolName === 'nodia_rental_reservations_list',
    )!;
    await list.handler({ property_id: '2' }, f.context);
    expect(f.ports[17].execute).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: f.context.manager }),
      '2',
      { page: 1, limit: 25 },
    );
    await expect(
      list.handler({ property_id: '2', query: { limit: 101 } }, f.context),
    ).rejects.toThrow('rental:invalid_input');
    vi.mocked(f.ports[4].execute).mockResolvedValueOnce({
      reservations: Array.from({ length: 101 }, () => ({})),
    });
    const calendar = f.family.capabilities.find(
      (t) => t.toolName === 'nodia_rental_calendar_calendar',
    )!;
    await expect(
      calendar.handler(
        {
          property_id: '2',
          query: { from_on: '2026-01-01', to_on: '2026-01-02' },
        },
        f.context,
      ),
    ).rejects.toThrow('rental:window_too_large');
  });
  it('summarizes the audit without delivering historical arbitrary JSON', async () => {
    const f = fixture();
    vi.mocked(f.ports[0].execute).mockResolvedValueOnce({
      data: [
        {
          id: '1',
          property_id: '2',
          actor_id: '1',
          action: 'property.update',
          resource_type: 'property',
          resource_id: '2',
          created_at: '2026-01-01T00:00:00.000Z',
          changes: { secret: 'not part of tool projection' },
        },
      ],
      meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    });
    const tool = f.family.capabilities.find(
      (t) => t.toolName === 'nodia_rental_audit_list',
    )!;
    const result = await tool.handler({ property_id: '2' }, f.context);
    f.registry.validateOutput(f.registry.get(tool.toolName)!, result);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('changes');
  });
});
