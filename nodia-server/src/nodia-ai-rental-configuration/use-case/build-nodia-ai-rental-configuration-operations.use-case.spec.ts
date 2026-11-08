import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { MutationResult } from '../../rental-common/types/rental.types.js';
import { NodiaAiRentalConfigurationService } from '../nodia-ai-rental-configuration.service.js';
import { BuildNodiaAiRentalConfigurationOperationsUseCase } from './build-nodia-ai-rental-configuration-operations.use-case.js';
import { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import { NodiaAiProposal } from '../../nodia-ai-proposal/entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';

const session = '11111111-1111-4111-8111-111111111111';
const rules = [
  { min_days_before: 0, refund_percent: '0' },
  { min_days_before: 7, refund_percent: '50' },
];
function fixture() {
  const property: NodiaAiJsonObject = {
    id: '10',
    owner_id: '1',
    name: 'Casa',
    location: null,
    timezone: 'America/Santiago',
    max_guests: 6,
    check_in_time: null,
    check_out_time: null,
    default_nightly_rate: null,
    default_deposit_percent: null,
    minimum_turnover_minutes: 0,
    default_cancellation_policy_id: null,
    notes: null,
    is_active: true,
    updated_at: '2026-10-17 12:00:00.123456+00',
  };
  const collaborator: NodiaAiJsonObject = {
    id: '20',
    property_id: '10',
    user_id: '2',
    position: null,
    is_active: true,
    updated_at: '2026-10-17 12:00:00.123456+00',
  };
  const policy: NodiaAiJsonObject = {
    id: '30',
    property_id: '10',
    name: 'Flexible',
    is_active: true,
    updated_at: '2026-10-17 12:00:00.123456+00',
  };
  const policyRules: NodiaAiJsonObject[] = [
    {
      id: '40',
      min_days_before: 0,
      refund_percent: '0.00',
      updated_at: '2026-10-17 12:00:00.123456+00',
    },
  ];
  const state = {
    actor: '1',
    superAdmin: false,
    authenticated: true,
    userActive: true,
    userExists: true,
    member: false,
    duplicate: false,
    history: false,
    maxGuests: 0,
    propertyExists: true,
    policyExists: true,
    collaboratorExists: true,
    turnovers: [] as NodiaAiJsonObject[],
  };
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.startsWith('SELECT u.id'))
      return state.authenticated
        ? [
            {
              actorId: state.actor,
              sessionId: session,
              isSuperAdmin: state.superAdmin,
            },
          ]
        : [];
    if (sql.includes('FROM rental_properties WHERE'))
      return state.propertyExists && params[0] === '10'
        ? [structuredClone(property)]
        : [];
    if (sql.startsWith('SELECT id::text,name,is_active FROM users'))
      return state.userExists
        ? [{ id: params[0], name: 'Usuario', is_active: state.userActive }]
        : [];
    if (
      sql.includes('FROM rental_collaborators WHERE') &&
      sql.includes('user_id=$2')
    )
      return (state.member && params[1] === state.actor) ||
        (state.duplicate && params[1] === '2')
        ? [{ id: '20', is_active: true }]
        : [];
    if (sql.includes('FROM rental_collaborators WHERE'))
      return state.collaboratorExists && params[1] === '20'
        ? [structuredClone(collaborator)]
        : [];
    if (sql.includes('FROM rental_cancellation_policies WHERE'))
      return state.policyExists && params[1] === '30'
        ? [structuredClone(policy)]
        : [];
    if (sql.includes('FROM rental_cancellation_rules'))
      return structuredClone(policyRules);
    if (sql.includes(' AS exists')) return [{ exists: state.history }];
    if (sql.includes('coalesce(max(')) return [{ max_guests: state.maxGuests }];
    if (sql.includes('FROM rental_turnovers t'))
      return structuredClone(state.turnovers);
    return [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const native = (
    kind: 'property' | 'collaborator' | 'policy',
    operation: 'create' | 'update',
  ) => ({
    execute: vi.fn(async (..._args: unknown[]): Promise<MutationResult> => ({
      operation: `${kind}.${operation}`,
      property_id: kind === 'property' && operation === 'create' ? '99' : '10',
      resource_type: kind,
      resource_id:
        kind === 'property'
          ? operation === 'create'
            ? '99'
            : '10'
          : kind === 'collaborator'
            ? '20'
            : '30',
      status: 'active',
      updated_at: '2026-10-17T12:00:00.123Z',
    })),
  });
  const writers = [
    native('property', 'create'),
    native('property', 'update'),
    native('collaborator', 'create'),
    native('collaborator', 'update'),
    native('policy', 'create'),
    native('policy', 'update'),
  ] as const;
  const factory = new BuildNodiaAiRentalConfigurationOperationsUseCase(
    new NodiaAiRentalConfigurationService(),
    ...(writers as unknown as ConstructorParameters<
      typeof BuildNodiaAiRentalConfigurationOperationsUseCase
    > extends [unknown, ...infer Tail]
      ? Tail
      : never),
  );
  const ctx: ProposalPreparerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: session,
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/reservations'],
    conversationId: session,
    maxCollectionItems: 128,
    statementTimeoutMs: 1200,
  };
  const op = (name: string) =>
    factory.operations.find((p) => p.toolName === `nodia_${name}`)!;
  const ready = async (name: string, input: NodiaAiJsonObject) => {
    const port = op(name),
      result = await port.prepare(input, ctx);
    if (result.status !== 'ready') throw new Error(JSON.stringify(result));
    const step: StoredProposalStep = {
      ...result,
      id: session,
      toolName: port.toolName,
      contractHash: port.contractHash,
      position: 0,
      outputBindings: [],
    };
    return { port, step };
  };
  return {
    state,
    property,
    collaborator,
    policy,
    policyRules,
    query,
    manager,
    writers,
    factory,
    ctx,
    op,
    ready,
  };
}

const wirePolicy = runtimeFixture().policy;
const validator = new ValidateNodiaAiProposalUseCase(
  fixture().factory.operations,
  readFileSync(
    new URL(
      '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
      import.meta.url,
    ),
    'utf8',
  ),
  wirePolicy,
  new CanonicalizeNodiaAiProposalUseCase(wirePolicy),
);

describe('Build NodiaAI rental configuration operations', () => {
  it.each([
    ['rental_properties_prepare_create', { name: 'Casa', max_guests: 3 }],
    ['rental_properties_prepare_update', { property_id: '10', name: 'Nueva' }],
    [
      'rental_collaborators_prepare_create',
      { property_id: '10', user_id: '2' },
    ],
    [
      'rental_collaborators_prepare_update',
      { property_id: '10', id: '20', position: 'Encargado' },
    ],
    [
      'rental_cancellation_policies_prepare_create',
      { property_id: '10', name: 'Flexible', rules },
    ],
    [
      'rental_cancellation_policies_prepare_update',
      { property_id: '10', id: '30', rules },
    ],
  ] as const)(
    'compiles the actual %s preview against the closed shared wire contract',
    async (name, input) => {
      const f = fixture(),
        { port, step } = await f.ready(
          name,
          input as unknown as NodiaAiJsonObject,
        );
      const publicStep = { ...step.publicStep, step_id: step.id };
      validator.assert('PublicStep', publicStep);
      const now = new Date('2026-10-17T12:00:00.000Z');
      const proposal = Object.assign(new NodiaAiProposal(), {
        id: session,
        conversation_id: session,
        actor_id: '1',
        current_revision: 1,
        created_at: now,
      });
      const revision = Object.assign(new NodiaAiProposalRevision(), {
        proposal_id: session,
        revision: 1,
        state: 'ready',
        hash: '',
        catalog_version: port.catalogVersion,
        canonicalization_version: 'jcs-rfc8785/1',
        created_at: now,
        expires_at: new Date(now.getTime() + 900000),
      });
      const stored = Object.assign(new NodiaAiProposalStep(), {
        id: step.id,
        proposal_id: session,
        proposal_revision: 1,
        position: 1,
        tool_name: port.toolName,
        contract_hash: port.contractHash,
        kind: 'domain_change',
        effect_key: step.publicStep.effect_key,
        scope: step.scope,
        command_template: step.commandTemplate,
        preconditions: step.preconditions,
        output_bindings: [],
        public_step: publicStep,
      });
      expect(() =>
        validator.compile(proposal, revision, [stored], false),
      ).not.toThrow();
      if (name === 'rental_properties_prepare_create') {
        expect(publicStep.changes).toContainEqual(
          expect.objectContaining({
            field_key: 'owner_id',
            origin: 'database',
          }),
        );
        expect(publicStep.changes).toContainEqual(
          expect.objectContaining({
            field_key: 'timezone',
            origin: 'contract_default',
          }),
        );
      }
    },
  );
  it('shows the true recipient read-only because changing scope requires another proposal', async () => {
    const f = fixture();
    f.state.superAdmin = true;
    const { port, step } = await f.ready('rental_properties_prepare_create', {
      name: 'Casa',
      max_guests: 4,
      owner_id: '2',
    });
    expect(
      port.reviewFields?.some((field) => field.field_key === 'owner_id'),
    ).toBe(false);
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'owner_id',
        after: '2',
        after_present: true,
        origin: 'user',
      }),
    );
    expect(step.scope).toEqual({ subject_user_id: '2' });
  });
  it('registers exactly six current native operations, without deletes or future references', () => {
    const f = fixture();
    expect(f.factory.operations).toHaveLength(6);
    for (const port of f.factory.operations) {
      expect(port.moduleRoutes).toEqual(['/reservations']);
      expect(port.catalogVersion).toBe('nodia-ai-ai24-rental-configuration/1');
      expect(port.bindableFields).toEqual({});
      expect(port.contractHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
  it('asks for only missing mandatory property fields, without writing', async () => {
    const f = fixture(),
      result = await f
        .op('rental_properties_prepare_create')
        .prepare({ name: 'Casa' }, f.ctx);
    expect(result.status).toBe('needs_clarification');
    if (result.status !== 'needs_clarification') return;
    expect(result.missingFields).toEqual(['max_guests']);
    expect(result.partial.command).toMatchObject({
      name: 'Casa',
      owner_id: '1',
    });
    expect(f.writers.every((w) => !w.execute.mock.calls.length)).toBe(true);
  });
  it('retains the backend request key across clarification, edits and reprepare', async () => {
    const f = fixture(),
      port = f.op('rental_properties_prepare_create'),
      partial = await port.prepare({ name: ' Casa ' }, f.ctx);
    if (partial.status !== 'needs_clarification') throw new Error();
    const complete = await port.prepare(
      { max_guests: 5 },
      f.ctx,
      partial.partial,
    );
    if (complete.status !== 'ready') throw new Error();
    expect(complete.commandTemplate.request_key).toBe(
      partial.partial.request_key,
    );
    const edited = await port.applyEdits(
        complete.commandTemplate,
        [{ step_id: session, field_key: 'name', value: ' Otra ' }],
        f.ctx,
      ),
      again = await port.reprepareStored(edited, f.ctx);
    if (again.status !== 'ready') throw new Error();
    expect(again.commandTemplate.request_key).toBe(partial.partial.request_key);
    expect(again.commandTemplate.command).toMatchObject({ name: 'Otra' });
  });
  it('freezes the real deployment timezone and nullable native defaults before confirmation', async () => {
    const f = fixture();
    vi.stubEnv('RENTAL_DEFAULT_TIMEZONE', 'Europe/Madrid');
    try {
      const { step } = await f.ready('rental_properties_prepare_create', {
        name: 'Casa',
        max_guests: 4,
      });
      expect(step.commandTemplate.command).toMatchObject({
        owner_id: '1',
        timezone: 'Europe/Madrid',
        check_in_time: null,
        check_out_time: null,
        is_active: true,
        minimum_turnover_minutes: 0,
      });
      expect(step.scope).toEqual({ subject_user_id: '1' });
      vi.stubEnv('RENTAL_DEFAULT_TIMEZONE', 'UTC');
      await f
        .op('rental_properties_prepare_create')
        .verifyPreconditions(step, f.ctx);
      expect(step.commandTemplate.command).toMatchObject({
        timezone: 'Europe/Madrid',
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('rejects invalid deployment timezone rather than fabricating one', async () => {
    const f = fixture();
    vi.stubEnv('RENTAL_DEFAULT_TIMEZONE', 'Invalid/Zone');
    try {
      await expect(
        f.ready('rental_properties_prepare_create', {
          name: 'Casa',
          max_guests: 4,
        }),
      ).rejects.toThrow('invalid_input');
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('requires owner authority for another owner but permits real super_admin authoring', async () => {
    const f = fixture();
    await expect(
      f.ready('rental_properties_prepare_create', {
        name: 'Casa',
        max_guests: 4,
        owner_id: '2',
      }),
    ).rejects.toThrow('owner_required');
    f.state.superAdmin = true;
    const { step } = await f.ready('rental_properties_prepare_create', {
      name: 'Casa',
      max_guests: 4,
      owner_id: '2',
    });
    expect(step.scope).toEqual({ subject_user_id: '2' });
    expect(step.commandTemplate.command).toMatchObject({ owner_id: '2' });
  });
  it.each([false, true])(
    'rejects a missing/inactive selected owner (exists=%s)',
    async (exists) => {
      const f = fixture();
      f.state.userExists = exists;
      f.state.userActive = false;
      await expect(
        f.ready('rental_properties_prepare_create', {
          name: 'Casa',
          max_guests: 4,
        }),
      ).rejects.toThrow('not_found');
    },
  );
  it('rejects absent module, inactive transaction and revoked authentication before domain lookup', async () => {
    const f = fixture();
    f.ctx = { ...f.ctx };
    await expect(
      f
        .op('rental_properties_prepare_create')
        .prepare(
          { name: 'Casa', max_guests: 4 },
          { ...f.ctx, moduleRoutes: [] },
        ),
    ).rejects.toThrow('capability_denied');
    (
      f.manager.queryRunner as { isTransactionActive: boolean }
    ).isTransactionActive = false;
    await expect(
      f
        .op('rental_properties_prepare_create')
        .prepare({ name: 'Casa', max_guests: 4 }, f.ctx),
    ).rejects.toThrow('capability_denied');
    (
      f.manager.queryRunner as { isTransactionActive: boolean }
    ).isTransactionActive = true;
    f.state.authenticated = false;
    await expect(
      f.ready('rental_properties_prepare_create', {
        name: 'Casa',
        max_guests: 4,
      }),
    ).rejects.toThrow('session_expired');
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('FROM rental_properties'),
      ),
    ).toBe(false);
  });
  it('distinguishes inaccessible houses (404) from collaborator owner-only configuration (403)', async () => {
    const f = fixture();
    f.property.owner_id = '2';
    await expect(
      f.ready('rental_properties_prepare_update', {
        property_id: '10',
        name: 'Otra',
      }),
    ).rejects.toThrow('not_found');
    f.state.member = true;
    await expect(
      f.ready('rental_properties_prepare_update', {
        property_id: '10',
        name: 'Otra',
      }),
    ).rejects.toThrow('owner_required');
    f.state.superAdmin = true;
    await expect(
      f.ready('rental_properties_prepare_update', {
        property_id: '10',
        name: 'Otra',
      }),
    ).resolves.toBeDefined();
  });
  it('asks for scope and nonempty changes on updates', async () => {
    const f = fixture(),
      p = f.op('rental_properties_prepare_update');
    const result = await p.prepare({}, f.ctx);
    expect(result.status).toBe('needs_clarification');
    if (result.status === 'needs_clarification')
      expect(result.missingFields).toEqual(['property_id', 'id', 'changes']);
    const { step } = await f.ready('rental_properties_prepare_update', {
      property_id: '10',
      notes: null,
    });
    expect(step.commandTemplate.id).toBe('10');
    expect(step.commandTemplate.command).toEqual({ notes: null });
  });
  it.each([
    { name: 'Casa', max_guests: 0 },
    { name: null, max_guests: 1 },
    { name: 'Casa', max_guests: '2' },
    { name: 'Casa', max_guests: 1, owner_id: 2 },
    { name: 'Casa', max_guests: 1, request_key: session },
    { name: 'Casa', max_guests: 1, created_by: '2' },
    { name: 'Casa', max_guests: 1, command: {} },
    { name: 'Casa', max_guests: 1, default_nightly_rate: '0' },
    { name: 'Casa', max_guests: 1, default_deposit_percent: '101' },
  ])('rejects invalid or privileged create input %j', async (input) => {
    const f = fixture();
    await expect(
      f
        .op('rental_properties_prepare_create')
        .prepare(input as NodiaAiJsonObject, f.ctx),
    ).rejects.toThrow('invalid_input');
  });
  it('rejects property target disagreement and immutable ownership changes', async () => {
    const f = fixture();
    await expect(
      f.ready('rental_properties_prepare_update', {
        property_id: '10',
        id: '11',
        name: 'Casa',
      }),
    ).rejects.toThrow('invalid_input');
    await expect(
      f.ready('rental_properties_prepare_update', {
        property_id: '10',
        owner_id: '2',
      }),
    ).rejects.toThrow('invalid_input');
  });
  it('archives only the property row without touching reservations or money', async () => {
    const f = fixture(),
      { port, step } = await f.ready('rental_properties_prepare_update', {
        property_id: '10',
        is_active: false,
      });
    await port.executeConfirmed(step, f.ctx);
    expect(f.writers[1].execute.mock.calls[0]?.[2]).toEqual({
      is_active: false,
    });
    expect(
      f.writers
        .filter((_, i) => i !== 1)
        .every((w) => w.execute.mock.calls.length === 0),
    ).toBe(true);
  });
  it('rejects timezone mutation with history and occupancy reduction below current guests', async () => {
    const f = fixture();
    f.state.history = true;
    await expect(
      f.ready('rental_properties_prepare_update', {
        property_id: '10',
        timezone: 'UTC',
      }),
    ).rejects.toThrow('agreement_immutable');
    f.state.maxGuests = 5;
    await expect(
      f.ready('rental_properties_prepare_update', {
        property_id: '10',
        max_guests: 4,
      }),
    ).rejects.toThrow('invalid_transition');
  });
  it('rejects an increased turnaround that breaks an already approved transition', async () => {
    const f = fixture();
    f.state.turnovers = [
      {
        id: '1',
        linen_ready: true,
        planned_ready_at: '2026-10-17 14:00:00+00',
        previous_out: '2026-10-17 13:00:00+00',
        incoming_at: '2026-10-17 15:00:00+00',
        updated_at: 'same',
      },
    ];
    await expect(
      f.ready('rental_properties_prepare_update', {
        property_id: '10',
        minimum_turnover_minutes: 180,
      }),
    ).rejects.toThrow('turnover_required');
  });
  it('rejects new collaborators in archived houses and duplicate or owner memberships', async () => {
    const f = fixture();
    f.property.is_active = false;
    await expect(
      f.ready('rental_collaborators_prepare_create', {
        property_id: '10',
        user_id: '2',
      }),
    ).rejects.toThrow('invalid_transition');
    f.property.is_active = true;
    await expect(
      f.ready('rental_collaborators_prepare_create', {
        property_id: '10',
        user_id: '1',
      }),
    ).rejects.toThrow('invalid_transition');
    f.state.duplicate = true;
    await expect(
      f.ready('rental_collaborators_prepare_create', {
        property_id: '10',
        user_id: '2',
      }),
    ).rejects.toThrow('invalid_transition');
  });
  it('allows revocation in archived houses but forbids reactivation there', async () => {
    const f = fixture();
    f.property.is_active = false;
    const { step } = await f.ready('rental_collaborators_prepare_update', {
      property_id: '10',
      id: '20',
      is_active: false,
    });
    expect(step.commandTemplate.command).toEqual({ is_active: false });
    f.collaborator.is_active = false;
    await expect(
      f.ready('rental_collaborators_prepare_update', {
        property_id: '10',
        id: '20',
        is_active: true,
      }),
    ).rejects.toThrow('invalid_transition');
  });
  it('checks the active user when granting and reactivating access', async () => {
    const f = fixture();
    f.state.userActive = false;
    await expect(
      f.ready('rental_collaborators_prepare_create', {
        property_id: '10',
        user_id: '2',
      }),
    ).rejects.toThrow('not_found');
    f.collaborator.is_active = false;
    await expect(
      f.ready('rental_collaborators_prepare_update', {
        property_id: '10',
        id: '20',
        is_active: true,
      }),
    ).rejects.toThrow('not_found');
  });
  it('normalizes sorted complete rules and exposes the structured review descriptor', async () => {
    const f = fixture(),
      { port, step } = await f.ready(
        'rental_cancellation_policies_prepare_create',
        { property_id: '10', name: ' Flexible ', rules: [...rules].reverse() },
      );
    expect(step.commandTemplate.command).toEqual({
      name: 'Flexible',
      is_active: true,
      rules: [
        { min_days_before: 0, refund_percent: '0.00' },
        { min_days_before: 7, refund_percent: '50.00' },
      ],
    });
    expect(
      port.reviewFields?.find((r) => r.field_key === 'rules'),
    ).toMatchObject({
      kind: 'rental_cancellation_rules',
      minimum: '1',
      maximum: '100',
      nullable: false,
      options: [],
    });
  });
  it.each([
    [],
    [{ min_days_before: 1, refund_percent: '50' }],
    [
      { min_days_before: 0, refund_percent: '0' },
      { min_days_before: 0, refund_percent: '50' },
    ],
    [{ min_days_before: 0 }],
    [{ min_days_before: 0, refund_percent: '101' }],
    [{ min_days_before: 0, refund_percent: '50', id: '1' }],
  ])('rejects invalid whole rules %j', async (value) => {
    const f = fixture();
    await expect(
      f.ready('rental_cancellation_policies_prepare_create', {
        property_id: '10',
        name: 'Flexible',
        rules: value,
      }),
    ).rejects.toThrow('invalid_input');
  });
  it('replaces rules as a validated whole, preserves the request key and rejects duplicate edits', async () => {
    const f = fixture(),
      { port, step } = await f.ready(
        'rental_cancellation_policies_prepare_update',
        { property_id: '10', id: '30', name: 'Nueva' },
      );
    const edited = await port.applyEdits(
      step.commandTemplate,
      [{ step_id: session, field_key: 'rules', value: rules }],
      f.ctx,
    );
    expect(edited.request_key).toBe(step.commandTemplate.request_key);
    expect(edited.command).toMatchObject({
      rules: [
        { min_days_before: 0, refund_percent: '0.00' },
        { min_days_before: 7, refund_percent: '50.00' },
      ],
    });
    await expect(
      port.applyEdits(
        step.commandTemplate,
        [{ step_id: session, field_key: 'rules', value: [] }],
        f.ctx,
      ),
    ).rejects.toThrow('invalid_input');
    await expect(
      port.applyEdits(
        step.commandTemplate,
        [
          { step_id: session, field_key: 'name', value: 'A' },
          { step_id: session, field_key: 'name', value: 'B' },
        ],
        f.ctx,
      ),
    ).rejects.toThrow('invalid_input');
  });
  it('prohibits disabling the default policy and selecting an inactive or unrelated default', async () => {
    const f = fixture();
    f.property.default_cancellation_policy_id = '30';
    await expect(
      f.ready('rental_cancellation_policies_prepare_update', {
        property_id: '10',
        id: '30',
        is_active: false,
      }),
    ).rejects.toThrow('invalid_transition');
    f.policy.is_active = false;
    await expect(
      f.ready('rental_properties_prepare_update', {
        property_id: '10',
        default_cancellation_policy_id: '30',
      }),
    ).rejects.toThrow('invalid_transition');
    await expect(
      f.ready('rental_properties_prepare_update', {
        property_id: '10',
        default_cancellation_policy_id: '31',
      }),
    ).rejects.toThrow('not_found');
  });
  it.each(['property', 'collaborator', 'rules', 'user'])(
    'rejects material %s changes even if its timestamp did not move',
    async (kind) => {
      const f = fixture();
      const { port, step } =
        kind === 'collaborator'
          ? await f.ready('rental_collaborators_prepare_update', {
              property_id: '10',
              id: '20',
              position: 'Otro',
            })
          : kind === 'rules'
            ? await f.ready('rental_cancellation_policies_prepare_update', {
                property_id: '10',
                id: '30',
                name: 'Otra',
              })
            : kind === 'user'
              ? await f.ready('rental_collaborators_prepare_create', {
                  property_id: '10',
                  user_id: '2',
                })
              : await f.ready('rental_properties_prepare_update', {
                  property_id: '10',
                  name: 'Otra',
                });
      if (kind === 'property') f.property.notes = 'Cambió';
      if (kind === 'collaborator') f.collaborator.position = 'Cambió';
      if (kind === 'rules') f.policyRules[0].refund_percent = '50.00';
      if (kind === 'user') f.state.userActive = false;
      await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
        'preconditions_changed',
      );
      expect(f.writers.every((w) => !w.execute.mock.calls.length)).toBe(true);
    },
  );
  it('rechecks property ownership after preview and never trusts stale actor flags', async () => {
    const f = fixture(),
      { port, step } = await f.ready('rental_properties_prepare_update', {
        property_id: '10',
        name: 'Otra',
      });
    f.property.owner_id = '2';
    await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
      'not_found',
    );
    expect(f.writers[1].execute).not.toHaveBeenCalled();
  });
  it.each([
    ['rental_properties_prepare_create', { name: 'Casa', max_guests: 3 }, 0],
    [
      'rental_properties_prepare_update',
      { property_id: '10', name: 'Nueva' },
      1,
    ],
    [
      'rental_collaborators_prepare_create',
      { property_id: '10', user_id: '2' },
      2,
    ],
    [
      'rental_collaborators_prepare_update',
      { property_id: '10', id: '20', position: 'Encargado' },
      3,
    ],
    [
      'rental_cancellation_policies_prepare_create',
      { property_id: '10', name: 'Flexible', rules },
      4,
    ],
    [
      'rental_cancellation_policies_prepare_update',
      { property_id: '10', id: '30', name: 'Nueva' },
      5,
    ],
  ] as const)(
    'dispatches %s with its immutable request identity in the caller transaction',
    async (name, input, index) => {
      const f = fixture(),
        { port, step } = await f.ready(
          name,
          input as unknown as NodiaAiJsonObject,
        );
      const result = await port.executeConfirmed(step, f.ctx);
      expect(result).toEqual({
        id: index === 0 ? '99' : index < 2 ? '10' : index < 4 ? '20' : '30',
        propertyId: index === 0 ? '99' : '10',
      });
      const args = f.writers[index].execute.mock.calls[0]!;
      expect(args[0]).toMatchObject({
        userId: '1',
        sessionId: session,
        transaction: f.manager,
        statementTimeoutMs: 1200,
      });
      expect(args.at(-1)).toBe(step.commandTemplate.request_key);
    },
  );
  it('rejects output whose native scope, operation or shape differs from the committed intent', async () => {
    const f = fixture(),
      { port, step } = await f.ready('rental_collaborators_prepare_update', {
        property_id: '10',
        id: '20',
        position: 'Encargado',
      });
    f.writers[3].execute.mockResolvedValueOnce({
      operation: 'collaborator.update',
      property_id: '11',
      resource_id: '20',
      resource_type: 'collaborator',
      status: 'active',
      updated_at: '2026-10-17T12:00:00.123Z',
    });
    await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
      'invalid_output',
    );
  });
  it('rejects coordinator metadata and caller replacement of request identity before writing', async () => {
    const f = fixture(),
      { port, step } = await f.ready('rental_properties_prepare_update', {
        property_id: '10',
        name: 'Nueva',
      });
    await expect(
      port.executeConfirmed(
        { ...step, outputBindings: [{ target_field_key: 'name' }] },
        f.ctx,
      ),
    ).rejects.toThrow('invalid_input');
    await expect(
      port.applyEdits(
        step.commandTemplate,
        [{ step_id: session, field_key: 'request_key', value: session }],
        f.ctx,
      ),
    ).rejects.toThrow('invalid_input');
    expect(f.writers[1].execute).not.toHaveBeenCalled();
  });
});
