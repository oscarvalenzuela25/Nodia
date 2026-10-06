import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalClock } from '../../rental-common/rental-clock.js';
import { RentalProperty } from '../entities/rental-property.entity.js';
import { RentalCollaborator } from '../../rental-collaborator/entities/rental-collaborator.entity.js';
import { RentalCancellationPolicy } from '../../rental-cancellation-policy/entities/rental-cancellation-policy.entity.js';
import { RentalCancellationRule } from '../../rental-cancellation-policy/entities/rental-cancellation-policy-rule.entity.js';
import { RentalOperation } from '../../rental-operation/entities/rental-operation.entity.js';
import { RentalAuditEvent } from '../../rental-audit/entities/rental-audit-event.entity.js';
import { User } from '../../user/entities/user.entity.js';
import { RentalPropertyService } from '../rental-property.service.js';
import { RentalCollaboratorService } from '../../rental-collaborator/rental-collaborator.service.js';
import { RentalCancellationPolicyService } from '../../rental-cancellation-policy/rental-cancellation-policy.service.js';
import { CreateRentalPropertyUseCase } from './create-rental-property.use-case.js';
import { UpdateRentalPropertyUseCase } from './update-rental-property.use-case.js';
import { GetRentalPropertyUseCase } from './get-rental-property.use-case.js';
import { GetRentalPropertiesUseCase } from './get-rental-properties.use-case.js';
import { CreateRentalCollaboratorUseCase } from '../../rental-collaborator/use-case/create-rental-collaborator.use-case.js';
import { UpdateRentalCollaboratorUseCase } from '../../rental-collaborator/use-case/update-rental-collaborator.use-case.js';
import { GetRentalCollaboratorsUseCase } from '../../rental-collaborator/use-case/get-rental-collaborators.use-case.js';
import { GetRentalCollaboratorCandidatesUseCase } from '../../rental-collaborator/use-case/get-rental-collaborator-candidates.use-case.js';
import { CreateRentalCancellationPolicyUseCase } from '../../rental-cancellation-policy/use-case/create-rental-cancellation-policy.use-case.js';
import { UpdateRentalCancellationPolicyUseCase } from '../../rental-cancellation-policy/use-case/update-rental-cancellation-policy.use-case.js';
import { GetRentalCancellationPolicyUseCase } from '../../rental-cancellation-policy/use-case/get-rental-cancellation-policy.use-case.js';
import { GetRentalCancellationPoliciesUseCase } from '../../rental-cancellation-policy/use-case/get-rental-cancellation-policies.use-case.js';
import type { CreateRentalPropertyDto } from '../dto/create-rental-property.dto.js';
import type { UpdateRentalPropertyDto } from '../dto/update-rental-property.dto.js';
import type {
  RentalConfigurationQueryDto,
  RentalCollaboratorCandidatesQueryDto,
} from '../dto/rental-configuration-query.dto.js';

type Row = Record<string, unknown>;
const key = '11111111-1111-4111-8111-111111111111';
const otherKey = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-10-04T16:00:00.000Z');
const creation: CreateRentalPropertyDto = {
  name: 'Casa sintética',
  timezone: 'America/Santiago',
  max_guests: 6,
  check_in_time: '15:00',
  check_out_time: '11:00',
};
const page = {
  page: 1,
  limit: 10,
  active: 'active',
} as RentalConfigurationQueryDto;

/** Persistence doubles only. Every access, replay and business rule runs in the real application. */
describe('Rental house, collaboration and cancellation application', () => {
  let tables: Map<unknown, Row[]>;
  let transactions: RentalTransactionService;
  let properties: RentalPropertyService;
  let collaborators: RentalCollaboratorService;
  let policies: RentalCancellationPolicyService;
  let manager: EntityManager;
  let hasHistory: boolean;
  let maxGuests: number;
  let transitions: Row[];
  const rows = (table: unknown) => tables.get(table)!;
  const put = (table: unknown, row: Row) => rows(table).push(row);
  const property = () => rows(RentalProperty)[0];
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([name, value]) => {
      const expected =
        value && typeof value === 'object' && 'value' in value
          ? (value as { value: unknown }).value
          : value;
      return Array.isArray(expected)
        ? expected.includes(row[name])
        : row[name] === expected;
    });

  beforeEach(() => {
    hasHistory = false;
    maxGuests = 0;
    transitions = [];
    tables = new Map(
      [
        RentalProperty,
        RentalCollaborator,
        RentalCancellationPolicy,
        RentalCancellationRule,
        RentalOperation,
        RentalAuditEvent,
        User,
      ].map((target) => [target, []]),
    );
    put(RentalProperty, {
      ...creation,
      id: '10',
      owner_id: '1',
      is_active: true,
      location: null,
      default_nightly_rate: null,
      default_deposit_percent: null,
      minimum_turnover_minutes: 0,
      default_cancellation_policy_id: null,
      notes: null,
      created_by: '1',
      updated_by: '1',
      created_at: now,
      updated_at: now,
    });
    put(RentalCollaborator, {
      id: '20',
      property_id: '10',
      user_id: '2',
      position: null,
      is_active: true,
      created_by: '1',
      updated_by: '1',
      created_at: now,
      updated_at: now,
    });
    for (const id of ['1', '2', '3', '4'])
      put(User, {
        id,
        name: `User ${id}`,
        email: 'SENSITIVE-SYNTHETIC',
        is_active: true,
      });
    const getRepository = (target: unknown) => ({
      findOne: vi.fn(async ({ where }: { where: Row }) => {
        const row = rows(target).find((row) => matches(row, where));
        return row ? structuredClone(row) : null;
      }),
      findOneBy: vi.fn(async (where: Row) => {
        const row = rows(target).find((row) => matches(row, where));
        return row ? structuredClone(row) : null;
      }),
      existsBy: vi.fn(async (where: Row) =>
        rows(target).some((row) => matches(row, where)),
      ),
      create: (data: Row) => ({ ...data }),
      save: vi.fn(async (input: Row | Row[]): Promise<Row | Row[]> => {
        if (Array.isArray(input)) {
          const result: Row[] = [];
          for (const row of input)
            result.push((await getRepository(target).save(row)) as Row);
          return result;
        }
        const saved = {
          ...input,
          id: input.id ?? String(100 + rows(target).length),
          created_at: input.created_at ?? now,
          updated_at: input.updated_at ?? now,
        };
        const index = rows(target).findIndex((row) => row.id === saved.id);
        if (index === -1) put(target, saved);
        else rows(target)[index] = saved;
        return structuredClone(saved);
      }),
      delete: vi.fn(async (where: Row) => {
        tables.set(
          target,
          rows(target).filter((row) => !matches(row, where)),
        );
      }),
    });
    manager = {
      getRepository,
      query: vi.fn(async (sql: string) => {
        if (sql.includes('AS found')) return [{ found: hasHistory }];
        if (sql.includes('max(guests_count)'))
          return [{ max_guests: maxGuests }];
        if (sql.includes('AS previous_out')) return transitions;
        return [];
      }),
    } as unknown as EntityManager;
    const source = {
      manager,
      createQueryRunner: () => {
        let snapshot: Map<unknown, Row[]>;
        return {
          manager,
          query: manager.query.bind(manager),
          isTransactionActive: false,
          async connect() {},
          async release() {},
          async startTransaction() {
            this.isTransactionActive = true;
            snapshot = new Map(
              [...tables].map(([target, values]) => [
                target,
                structuredClone(values),
              ]),
            );
          },
          async commitTransaction() {
            this.isTransactionActive = false;
          },
          async rollbackTransaction() {
            tables = snapshot;
            this.isTransactionActive = false;
          },
        };
      },
    } as unknown as DataSource;
    transactions = new RentalTransactionService(source, new RentalClock());
    properties = new RentalPropertyService();
    collaborators = new RentalCollaboratorService();
    policies = new RentalCancellationPolicyService();
    policies.rulesForPolicies = vi.fn(async (_manager, propertyId, ids) => {
      const allowed = rows(RentalCancellationPolicy)
        .filter(
          (row) =>
            row.property_id === propertyId && ids.includes(row.id as string),
        )
        .map((row) => row.id);
      return structuredClone(
        rows(RentalCancellationRule).filter((row) =>
          allowed.includes(row.policy_id),
        ),
      ).sort(
        (a, b) => Number(a.min_days_before) - Number(b.min_days_before),
      ) as unknown as RentalCancellationRule[];
    });
  });

  it('creates ownership and null policy from the principal and replays exactly once', async () => {
    const useCase = new CreateRentalPropertyUseCase(transactions, properties);
    const first = await useCase.execute('1', creation, key);
    const replay = await useCase.execute(
      '1',
      { ...creation, notes: '', minimum_turnover_minutes: 0, is_active: true },
      key,
    );
    expect(replay).toEqual(first);
    expect(rows(RentalProperty)).toHaveLength(2);
    expect(rows(RentalProperty)[1]).toMatchObject({
      owner_id: '1',
      default_cancellation_policy_id: null,
      default_nightly_rate: null,
    });
    expect(rows(RentalOperation)).toHaveLength(1);
    expect(rows(RentalAuditEvent)).toHaveLength(1);
    expect(first).not.toHaveProperty('name');
    await expect(
      useCase.execute('1', { ...creation, name: 'Otra' }, key),
    ).rejects.toThrow('rental:idempotency_conflict');
  });

  it.each([
    { owner_id: '3' },
    { max_guests: 0 },
    { max_guests: '6' },
    { timezone: '+03:00' },
    { check_in_time: '24:00' },
    { default_nightly_rate: 50000 },
    { default_nightly_rate: '9223372036854775808' },
    { is_active: null },
    { default_deposit_percent: '100.01' },
    { name: null },
  ])('rejects invalid house data before persistence %j', async (extra) => {
    await expect(
      new CreateRentalPropertyUseCase(transactions, properties).execute(
        '1',
        { ...creation, ...extra } as CreateRentalPropertyDto,
        key,
      ),
    ).rejects.toThrow('rental:invalid_input');
    expect(rows(RentalProperty)).toHaveLength(1);
    expect(rows(RentalAuditEvent)).toHaveLength(0);
  });

  it('preserves CLP above Number safe range and explicit 0 percent', async () => {
    await new UpdateRentalPropertyUseCase(transactions, properties).execute(
      '1',
      '10',
      {
        default_nightly_rate: '9007199254740993',
        default_deposit_percent: '0',
        minimum_turnover_minutes: 0,
      },
      key,
    );
    expect(property()).toMatchObject({
      default_nightly_rate: '9007199254740993',
      default_deposit_percent: '0.00',
      minimum_turnover_minutes: 0,
    });
  });

  it('projects membership for owner and collaborator and rejects outsiders', async () => {
    const read = new GetRentalPropertyUseCase(transactions);
    expect((await read.execute('1', '10')).membership).toMatchObject({
      type: 'owner',
      can_manage_configuration: true,
    });
    expect((await read.execute('2', '10')).membership).toMatchObject({
      type: 'collaborator',
      can_manage_configuration: false,
    });
    await expect(read.execute('3', '10')).rejects.toThrow('rental:not_found');
    rows(RentalCollaborator)[0].is_active = false;
    await expect(read.execute('2', '10')).rejects.toThrow('rental:not_found');
  });

  it('owner-only authority is enforced by real transaction access, including archived replay', async () => {
    const update = new UpdateRentalPropertyUseCase(transactions, properties);
    await expect(
      update.execute('2', '10', { name: 'Changed' }, key),
    ).rejects.toThrow('rental:owner_required');
    const first = await update.execute('1', '10', { is_active: false }, key);
    expect(await update.execute('1', '10', { is_active: false }, key)).toEqual(
      first,
    );
    expect(rows(RentalAuditEvent)).toHaveLength(1);
    await update.execute('1', '10', { is_active: true }, otherKey);
    expect(property().is_active).toBe(true);
  });

  it('does not reinterpret timezone once any reservation or block exists', async () => {
    hasHistory = true;
    const update = new UpdateRentalPropertyUseCase(transactions, properties);
    await expect(
      update.execute('1', '10', { timezone: 'Europe/Madrid' }, key),
    ).rejects.toThrow('rental:agreement_immutable');
    await update.execute('1', '10', { timezone: 'America/Santiago' }, key);
    expect(property().timezone).toBe('America/Santiago');
  });

  it('capacity cannot invalidate current bookings; earlier rejected key remains reusable', async () => {
    maxGuests = 5;
    const update = new UpdateRentalPropertyUseCase(transactions, properties);
    await expect(
      update.execute('1', '10', { max_guests: 4 }, key),
    ).rejects.toThrow('rental:invalid_transition');
    expect(property().max_guests).toBe(6);
    expect(rows(RentalOperation)).toHaveLength(0);
    await update.execute('1', '10', { max_guests: 5 }, key);
    expect(property().max_guests).toBe(5);
  });

  it('minimum turnover preserves an existing approval only if the plan stays valid', async () => {
    transitions = [
      {
        previous_out: new Date('2026-10-10T14:00:00Z'),
        incoming_at: new Date('2026-10-10T18:00:00Z'),
        planned_ready_at: new Date('2026-10-10T17:00:00Z'),
        linen_ready: true,
      },
    ];
    const update = new UpdateRentalPropertyUseCase(transactions, properties);
    await expect(
      update.execute('1', '10', { minimum_turnover_minutes: 181 }, key),
    ).rejects.toThrow('rental:turnover_required');
    await update.execute('1', '10', { minimum_turnover_minutes: 180 }, key);
    expect(property().minimum_turnover_minutes).toBe(180);
  });

  it('default policy must be active and belong to this exact house', async () => {
    put(RentalCancellationPolicy, {
      id: '30',
      property_id: '11',
      is_active: true,
    });
    const update = new UpdateRentalPropertyUseCase(transactions, properties);
    await expect(
      update.execute('1', '10', { default_cancellation_policy_id: '30' }, key),
    ).rejects.toThrow('rental:not_found');
    rows(RentalCancellationPolicy)[0].property_id = '10';
    rows(RentalCancellationPolicy)[0].is_active = false;
    await expect(
      update.execute('1', '10', { default_cancellation_policy_id: '30' }, key),
    ).rejects.toThrow('rental:invalid_transition');
    rows(RentalCancellationPolicy)[0].is_active = true;
    await update.execute(
      '1',
      '10',
      { default_cancellation_policy_id: '30' },
      key,
    );
    await update.execute(
      '1',
      '10',
      { default_cancellation_policy_id: null, notes: null },
      otherKey,
    );
    expect(property()).toMatchObject({
      default_cancellation_policy_id: null,
      notes: null,
    });
  });

  it.each([{}, { owner_id: '2' }, { name: null }, { is_active: 'false' }])(
    'rejects empty or immutable update %j',
    async (input) => {
      await expect(
        new UpdateRentalPropertyUseCase(transactions, properties).execute(
          '1',
          '10',
          input as unknown as UpdateRentalPropertyDto,
          key,
        ),
      ).rejects.toThrow('rental:invalid_input');
    },
  );

  it('house list uses explicit scope and bounded query before persistence', async () => {
    properties.findPage = vi.fn(
      async (): Promise<[RentalProperty[], number]> => [
        rows(RentalProperty) as unknown as RentalProperty[],
        1,
      ],
    );
    const useCase = new GetRentalPropertiesUseCase(transactions, properties);
    expect((await useCase.execute('1', page)).meta.total_items).toBe(1);
    expect(properties.findPage).toHaveBeenCalledWith(
      manager,
      '1',
      expect.objectContaining({ active: 'active' }),
    );
    await expect(
      useCase.execute('1', { ...page, q: { owner_id_eq: '3' } }),
    ).rejects.toThrow();
    await expect(
      useCase.execute('1', {
        ...page,
        all: true,
      } as RentalConfigurationQueryDto),
    ).rejects.toThrow();
    await expect(
      useCase.execute('1', { ...page, limit: 101 }),
    ).rejects.toThrow();
  });

  it('add collaborator validates active existing user, owner exclusion and existing membership', async () => {
    const create = new CreateRentalCollaboratorUseCase(
      transactions,
      collaborators,
    );
    await expect(
      create.execute('1', '10', { user_id: '1' }, key),
    ).rejects.toThrow('rental:invalid_transition');
    await expect(
      create.execute('1', '10', { user_id: '2' }, key),
    ).rejects.toThrow('rental:invalid_transition');
    rows(User).find((user) => user.id === '3')!.is_active = false;
    await expect(
      create.execute('1', '10', { user_id: '3' }, key),
    ).rejects.toThrow('rental:not_found');
    await expect(
      create.execute('2', '10', { user_id: '4' }, key),
    ).rejects.toThrow('rental:owner_required');
    const first = await create.execute(
      '1',
      '10',
      { user_id: '4', position: ' Encargado ' },
      key,
    );
    expect(
      await create.execute(
        '1',
        '10',
        { user_id: '4', position: 'Encargado' },
        key,
      ),
    ).toEqual(first);
    expect(rows(RentalCollaborator)).toHaveLength(2);
    expect(rows(RentalCollaborator)[1]).toMatchObject({
      user_id: '4',
      property_id: '10',
      position: 'Encargado',
      created_by: '1',
    });
  });

  it('revocation retains its row and authors; reactivation uses its same identity', async () => {
    const update = new UpdateRentalCollaboratorUseCase(
      transactions,
      collaborators,
    );
    await update.execute('1', '10', '20', { is_active: false }, key);
    await expect(
      new GetRentalPropertyUseCase(transactions).execute('2', '10'),
    ).rejects.toThrow('rental:not_found');
    await update.execute(
      '1',
      '10',
      '20',
      { is_active: true, position: null },
      otherKey,
    );
    expect(rows(RentalCollaborator)).toHaveLength(1);
    expect(rows(RentalCollaborator)[0]).toMatchObject({
      id: '20',
      user_id: '2',
      created_by: '1',
      is_active: true,
      position: null,
    });
  });

  it('archive permits revocation while denying new associations or reactivation', async () => {
    property().is_active = false;
    await expect(
      new CreateRentalCollaboratorUseCase(transactions, collaborators).execute(
        '1',
        '10',
        { user_id: '4' },
        key,
      ),
    ).rejects.toThrow('rental:invalid_transition');
    const update = new UpdateRentalCollaboratorUseCase(
      transactions,
      collaborators,
    );
    await update.execute('1', '10', '20', { is_active: false }, key);
    await expect(
      update.execute('1', '10', '20', { is_active: true }, otherKey),
    ).rejects.toThrow('rental:invalid_transition');
  });

  it('selector is owner-only, searches a name, rejects short search and caps to 20', async () => {
    collaborators.candidates = vi.fn(async (): Promise<[User[], number]> => [
      rows(User) as unknown as User[],
      4,
    ]);
    const candidates = new GetRentalCollaboratorCandidatesUseCase(
      transactions,
      collaborators,
    );
    const input = {
      search: 'User',
      page: 1,
      limit: 20,
    } as RentalCollaboratorCandidatesQueryDto;
    expect(
      (await candidates.execute('1', '10', input)).data[0],
    ).not.toHaveProperty('email');
    await expect(candidates.execute('2', '10', input)).rejects.toThrow(
      'rental:owner_required',
    );
    await expect(
      candidates.execute('1', '10', { ...input, search: 'ab' }),
    ).rejects.toThrow('rental:invalid_input');
    await expect(
      candidates.execute('1', '10', { ...input, limit: 21 }),
    ).rejects.toThrow('rental:invalid_input');
  });

  it('shared member list includes only projected user identity', async () => {
    collaborators.findPage = vi.fn(
      async (): Promise<[RentalCollaborator[], number]> => [
        [
          Object.assign(new RentalCollaborator(), rows(RentalCollaborator)[0], {
            relation_user_id: rows(User)[1],
          }),
        ],
        1,
      ],
    );
    const result = await new GetRentalCollaboratorsUseCase(
      transactions,
      collaborators,
    ).execute('2', '10', page);
    expect(result.data[0].user).toEqual({
      id: '2',
      name: 'User 2',
      image_url: null,
    });
    expect(JSON.stringify(result)).not.toContain('SENSITIVE-SYNTHETIC');
  });

  it('normalizes complete policy rules with zero coverage and owner-only authority', async () => {
    const create = new CreateRentalCancellationPolicyUseCase(
      transactions,
      policies,
    );
    const command = {
      name: 'Política',
      rules: [
        { min_days_before: 7, refund_percent: '33.33' },
        { min_days_before: 0, refund_percent: '0' },
      ],
    };
    await expect(create.execute('2', '10', command, key)).rejects.toThrow(
      'rental:owner_required',
    );
    const first = await create.execute('1', '10', command, key);
    expect(
      await create.execute(
        '1',
        '10',
        {
          ...command,
          rules: [
            { min_days_before: 0, refund_percent: '0.00' },
            { min_days_before: 7, refund_percent: '33.33' },
          ],
        },
        key,
      ),
    ).toEqual(first);
    expect(rows(RentalCancellationPolicy)).toHaveLength(1);
    expect(rows(RentalCancellationRule)).toHaveLength(2);
    const detail = await new GetRentalCancellationPolicyUseCase(
      transactions,
      policies,
    ).execute('2', '10', first.resource_id);
    expect(detail.rules.map((rule) => rule.refund_percent)).toEqual([
      '0.00',
      '33.33',
    ]);
  });

  it.each(
    (
      [
        [],
        [{ min_days_before: 1, refund_percent: '0' }],
        [
          { min_days_before: 0, refund_percent: '0' },
          { min_days_before: 0, refund_percent: '50' },
        ],
        [{ min_days_before: -1, refund_percent: '0' }],
        [{ min_days_before: 0, refund_percent: '100.01' }],
        [{ min_days_before: 0, refund_percent: 50 }],
        [{ min_days_before: 0, refund_percent: '33.333' }],
        [{ min_days_before: 0, refund_percent: '50', actor_id: '3' }],
      ] as unknown[]
    ).map((rules) => ({ rules })),
  )(
    'rejects invalid complete policy before inserting %j',
    async ({ rules }) => {
      await expect(
        new CreateRentalCancellationPolicyUseCase(
          transactions,
          policies,
        ).execute('1', '10', { name: 'Invalid', rules } as never, key),
      ).rejects.toThrow('rental:invalid_input');
      expect(rows(RentalCancellationPolicy)).toHaveLength(0);
      expect(rows(RentalAuditEvent)).toHaveLength(0);
    },
  );

  it('does not deactivate a default policy and preserves rules when omitted', async () => {
    const created = await new CreateRentalCancellationPolicyUseCase(
      transactions,
      policies,
    ).execute(
      '1',
      '10',
      { name: 'Policy', rules: [{ min_days_before: 0, refund_percent: '0' }] },
      key,
    );
    property().default_cancellation_policy_id = created.resource_id;
    const update = new UpdateRentalCancellationPolicyUseCase(
      transactions,
      policies,
    );
    await expect(
      update.execute(
        '1',
        '10',
        created.resource_id,
        { is_active: false },
        otherKey,
      ),
    ).rejects.toThrow('rental:invalid_transition');
    const ruleId = rows(RentalCancellationRule)[0].id;
    await update.execute(
      '1',
      '10',
      created.resource_id,
      { name: 'Renamed' },
      otherKey,
    );
    expect(rows(RentalCancellationRule)[0].id).toBe(ruleId);
    expect(rows(RentalCancellationPolicy)[0].is_active).toBe(true);
  });

  it('complete rule replacement reuses retained thresholds and removes replaced rules', async () => {
    const created = await new CreateRentalCancellationPolicyUseCase(
      transactions,
      policies,
    ).execute(
      '1',
      '10',
      {
        name: 'Policy',
        rules: [
          { min_days_before: 0, refund_percent: '0' },
          { min_days_before: 7, refund_percent: '50' },
        ],
      },
      key,
    );
    const zeroRuleId = rows(RentalCancellationRule)[0].id;
    await new UpdateRentalCancellationPolicyUseCase(
      transactions,
      policies,
    ).execute(
      '1',
      '10',
      created.resource_id,
      {
        rules: [
          { min_days_before: 0, refund_percent: '20' },
          { min_days_before: 14, refund_percent: '100' },
        ],
      },
      otherKey,
    );
    expect(rows(RentalCancellationRule)).toHaveLength(2);
    expect(
      rows(RentalCancellationRule).find((rule) => rule.min_days_before === 0),
    ).toMatchObject({
      id: zeroRuleId,
      created_by: '1',
      refund_percent: '20.00',
    });
    expect(
      rows(RentalCancellationRule).some((rule) => rule.min_days_before === 7),
    ).toBe(false);
  });

  it('failed rule persistence returns failure and has no operation acknowledgment', async () => {
    policies.replaceRules = vi.fn(async () => {
      throw new Error('synthetic failure');
    });
    await expect(
      new CreateRentalCancellationPolicyUseCase(transactions, policies).execute(
        '1',
        '10',
        {
          name: 'Policy',
          rules: [{ min_days_before: 0, refund_percent: '0' }],
        },
        key,
      ),
    ).rejects.toThrow('rental:server_error');
    expect(rows(RentalOperation)).toHaveLength(0);
    expect(rows(RentalAuditEvent)).toHaveLength(0);
    expect(rows(RentalCancellationPolicy)).toHaveLength(0);
  });

  it('scopes policy detail and list rules to the house, and empty results remain explicit', async () => {
    put(RentalCancellationPolicy, {
      id: '30',
      property_id: '11',
      is_active: true,
    });
    await expect(
      new GetRentalCancellationPolicyUseCase(transactions, policies).execute(
        '1',
        '10',
        '30',
      ),
    ).rejects.toThrow('rental:not_found');
    policies.findPage = vi.fn(
      async (): Promise<[RentalCancellationPolicy[], number]> => [[], 0],
    );
    const result = await new GetRentalCancellationPoliciesUseCase(
      transactions,
      policies,
    ).execute('2', '10', page);
    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total_items: 0, total_pages: 0 },
    });
  });
});
