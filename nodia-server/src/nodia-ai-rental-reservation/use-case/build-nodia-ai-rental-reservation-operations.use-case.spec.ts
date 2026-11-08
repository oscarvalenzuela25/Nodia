import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { NodiaAiProposal } from '../../nodia-ai-proposal/entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import type { RentalClock } from '../../rental-common/rental-clock.js';
import type { CalendarStay } from '../../rental-common/rental-calendar.rules.js';
import type { NodiaAiRentalReservationService } from '../nodia-ai-rental-reservation.service.js';
import type { NodiaAiRentalReservationAction as Action } from '../types/rental-reservation-operation.types.js';
import { BuildNodiaAiRentalReservationOperationsUseCase } from './build-nodia-ai-rental-reservation-operations.use-case.js';

const session = '1057a24d-4d46-4ca2-93c3-3711284cfb76';
const create: NodiaAiJsonObject = {
  property_id: '10',
  guest_name: 'Visita',
  guest_contact: '123',
  guests_count: 2,
  channel: 'whatsapp',
  check_in_on: '2030-05-03',
  check_out_on: '2030-05-05',
  check_in_time: '15:00',
  check_out_time: '11:00',
  nightly_rate: '10000',
  deposit_amount: '4000',
};
const actions: Action[] = [
  'create',
  'update',
  'confirm',
  'start',
  'complete',
  'cancel',
];
function fixture() {
  const property: NodiaAiJsonObject = {
    id: '10',
    owner_id: '1',
    name: 'Casa',
    timezone: 'UTC',
    max_guests: 6,
    minimum_turnover_minutes: 0,
    is_active: true,
  };
  const target: NodiaAiJsonObject = {
    ...create,
    id: '20',
    external_reference: null,
    cleaning_fee: '0',
    discount_amount: '0',
    commission_amount: '0',
    total_amount: '20000',
    deposit_due_at: null,
    balance_due_at: null,
    cancellation_policy_id: null,
    policy_snapshot: null,
    status: 'draft',
    cancelled_at: null,
    refund_amount: null,
    cancellation_snapshot: null,
    notes: null,
    is_active: true,
    updated_at: '2030-05-01 00:00:00.123456+00',
  };
  const state = {
    actor: '1',
    superAdmin: false,
    authenticated: true,
    member: false,
    exists: true,
    now: new Date('2030-05-01T12:00:00.000Z'),
    hasMoney: false,
    received: '0',
    refunded: '0',
    hash: 'a'.repeat(64),
  };
  const calendar = {
    available: true,
    check_in_at: '2030-05-03T15:00:00.000Z',
    check_out_at: '2030-05-05T11:00:00.000Z',
    conflicts: [] as NodiaAiJsonObject[],
    turnover_requirements: [] as {
      incoming_reservation_id: string | null;
      turnover_id: string | null;
      needs_approval: boolean;
      plan_valid: boolean;
    }[],
    previous: null as CalendarStay | null,
    next: null as CalendarStay | null,
    turnovers: [
      {
        id: '30',
        incoming_reservation_id: '20',
        previous_reservation_id: null,
        linen_ready: true,
        cleaning_status: 'completed',
        planned_ready_at: null,
        ready_at: '2030-05-03T14:00:00.000Z',
        same_day_approved_at: null,
        updated_at: '2030-05-01 00:00:00+00',
      },
    ] as NodiaAiJsonObject[],
  };
  const query = vi.fn(async (sql: string) => {
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
    if (sql.includes('SUM(amount)'))
      return [{ received: state.received, refunded: state.refunded }];
    if (sql.includes('id>$3')) return [];
    return [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const store = {
    property: vi.fn(async () => structuredClone(property)),
    member: vi.fn(async () => state.member),
    reservation: vi.fn(async () =>
      state.exists ? structuredClone(target) : null,
    ),
    money: vi.fn(async () => ({
      has_money: state.hasMoney,
      received: state.received,
      refunded: state.refunded,
      ledger: { hash: state.hash, count: state.hasMoney ? 1 : 0 },
    })),
    hasMoney: vi.fn(async () => state.hasMoney),
    policy: vi.fn(async () => null),
    calendar: vi.fn(async () => structuredClone(calendar)),
    preparation: vi.fn(async () =>
      structuredClone({
        previous: calendar.previous,
        turnovers: calendar.turnovers,
      }),
    ),
  };
  const writers = actions.map((operation) => ({
    execute: vi.fn(async (..._args: unknown[]) => ({
      operation: `reservation.${operation}`,
      property_id: '10',
      resource_id: operation === 'create' ? '99' : '20',
      resource_type: 'reservation',
      status:
        operation === 'create'
          ? 'draft'
          : operation === 'update'
            ? target.status
            : operation === 'confirm'
              ? 'confirmed'
              : operation === 'start'
                ? 'in_progress'
                : operation === 'complete'
                  ? 'completed'
                  : 'cancelled',
      updated_at: '2030-05-01T12:00:00.000Z',
    })),
  }));
  const factory = new BuildNodiaAiRentalReservationOperationsUseCase(
    store as unknown as NodiaAiRentalReservationService,
    { now: () => state.now } as RentalClock,
    ...(writers as unknown as ConstructorParameters<
      typeof BuildNodiaAiRentalReservationOperationsUseCase
    > extends [unknown, unknown, ...infer R]
      ? R
      : never),
  );
  const ctx = {
    actor: { actorId: '1', sessionId: session, isSuperAdmin: false },
    manager,
    moduleRoutes: ['/reservations'],
    actionKeys: [],
    conversationId: session,
    statementTimeoutMs: 1200,
  } as unknown as ProposalPreparerContext;
  const op = (action: Action) =>
    factory.operations.find((p) => p.operation === action)!;
  const ready = async (action: Action, input: NodiaAiJsonObject) => {
    const port = op(action),
      r = await port.prepare(input, ctx);
    expect(r.status).toBe('ready');
    if (r.status !== 'ready') throw new Error('notready');
    const step: StoredProposalStep = {
      ...r,
      id: session,
      toolName: port.toolName,
      contractHash: port.contractHash,
      position: 1,
      outputBindings: [],
    };
    return { port, step };
  };
  const forAction = (action: Action): NodiaAiJsonObject => {
    if (action === 'create') return { ...create };
    if (action === 'update')
      return { property_id: '10', id: '20', notes: 'Nueva' };
    if (action === 'confirm') {
      target.channel = 'airbnb';
      target.deposit_amount = '0';
      target.external_reference = 'booking';
      return {
        property_id: '10',
        id: '20',
        platform_policy: {
          reference: 'externa',
          description: 'Condiciones reales',
        },
      };
    }
    if (action === 'start') {
      target.status = 'confirmed';
      state.now = new Date('2030-05-03T16:00:00.000Z');
    }
    if (action === 'complete') {
      target.status = 'in_progress';
      state.now = new Date('2030-05-05T12:00:00.000Z');
    }
    return {
      property_id: '10',
      id: '20',
      ...(action === 'cancel'
        ? { cancelled_at: '2030-05-01T10:00:00.000Z' }
        : {}),
    };
  };
  return {
    property,
    target,
    state,
    calendar,
    manager,
    query,
    store,
    writers,
    factory,
    ctx,
    op,
    ready,
    forAction,
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

describe('Build NodiaAI rental reservation operations', () => {
  it.each(actions)(
    'compiles the real %s PublicStep and canonical proposal with the closed wire schema',
    async (action) => {
      const f = fixture(),
        { port, step } = await f.ready(action, f.forAction(action)),
        publicStep = { ...step.publicStep, step_id: step.id };
      validator.assert('PublicStep', publicStep);
      const now = f.state.now,
        proposal = Object.assign(new NodiaAiProposal(), {
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
    },
  );
  it('asks every real minimum without inheriting property times, pricing or creating payment', async () => {
    const f = fixture(),
      r = await f.op('create').prepare({}, f.ctx);
    expect(r.status).toBe('needs_clarification');
    if (r.status !== 'needs_clarification') return;
    expect(r.missingFields).toEqual([
      'property_id',
      ...Object.keys(create).filter((k) => k !== 'property_id'),
    ]);
    expect(f.writers.every((w) => !w.execute.mock.calls.length)).toBe(true);
  });
  it('creates only a draft with native zero/null defaults and exact BigInt totals', async () => {
    const f = fixture(),
      { step } = await f.ready('create', {
        ...create,
        nightly_rate: '4503599627370496',
        deposit_amount: '0',
      });
    expect(step.preconditions.total_amount).toBe('9007199254740992');
    expect(step.commandTemplate.command).toMatchObject({
      cleaning_fee: '0',
      discount_amount: '0',
      commission_amount: '0',
      cancellation_policy_id: null,
    });
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'status',
        after: 'draft',
        origin: 'database',
      }),
    );
  });
  it('freezes native text transforms before preview, editing and writer dispatch', async () => {
    const f = fixture(),
      { port, step } = await f.ready('create', {
        ...create,
        guest_name: '  Visita  ',
        notes: '  ',
      });
    expect(step.commandTemplate.command).toMatchObject({
      guest_name: 'Visita',
      notes: null,
    });
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({ field_key: 'guest_name', after: 'Visita' }),
    );
    await port.executeConfirmed(step, f.ctx);
    expect(f.writers[0].execute.mock.calls[0]?.[2]).toMatchObject({
      guest_name: 'Visita',
      notes: null,
    });
    const g = fixture(),
      ready = await g.ready('confirm', {
        ...g.forAction('confirm'),
        platform_policy: {
          reference: '  externa ',
          description: '  Condiciones reales  ',
        },
      });
    expect(ready.step.commandTemplate.command).toMatchObject({
      platform_policy: {
        reference: 'externa',
        description: 'Condiciones reales',
      },
    });
  });
  it.each([
    { ...create, status: 'confirmed' },
    { ...create, request_key: session },
    { ...create, nightly_rate: 10000 },
    { ...create, check_in_time: null },
    { ...create, total_amount: '1' },
    { property_id: '10', id: '20', expected_refund_amount: '0' },
  ])('rejects untrusted or invalid fields %j', async (input) => {
    const f = fixture();
    await expect(
      f.op('create').prepare(input as NodiaAiJsonObject, f.ctx),
    ).rejects.toThrow('invalid_input');
  });
  it('normalizes equivalent timestamps, preserves intent on clarification and forbids scope changes', async () => {
    const f = fixture(),
      partial = await f
        .op('create')
        .prepare({ property_id: '10', guest_name: 'Visita' }, f.ctx);
    if (partial.status !== 'needs_clarification') throw new Error('partial');
    const result = await f
      .op('create')
      .prepare(
        { ...create, deposit_due_at: '2030-05-02T03:00:00+03:00' },
        f.ctx,
        partial.partial,
      );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.commandTemplate.request_key).toBe(
      partial.partial.request_key,
    );
    expect(
      (result.commandTemplate.command as NodiaAiJsonObject).deposit_due_at,
    ).toBe('2030-05-02T00:00:00.000Z');
    await expect(
      f
        .op('create')
        .prepare({ ...create, property_id: '11' }, f.ctx, partial.partial),
    ).rejects.toThrow('invalid_input');
  });
  it.each(['hasMoney', 'phase'] as const)(
    'freezes the agreement after %s and still allows contact updates',
    async (reason) => {
      const f = fixture();
      if (reason === 'hasMoney') f.state.hasMoney = true;
      else f.target.status = 'confirmed';
      await expect(
        f.ready('update', {
          property_id: '10',
          id: '20',
          nightly_rate: '20000',
        }),
      ).rejects.toThrow('agreement_immutable');
      await expect(
        f.ready('update', { property_id: '10', id: '20', guest_name: 'Otro' }),
      ).resolves.toBeDefined();
    },
  );
  it('requires a real direct deposit instead of creating money to confirm', async () => {
    const f = fixture();
    await expect(
      f.ready('confirm', { property_id: '10', id: '20' }),
    ).rejects.toThrow('deposit_required');
    expect(f.writers.every((w) => !w.execute.mock.calls.length)).toBe(true);
  });
  it('asks platform conditions rather than fabricating them', async () => {
    const f = fixture();
    f.target.channel = 'airbnb';
    f.target.deposit_amount = '0';
    const r = await f
      .op('confirm')
      .prepare({ property_id: '10', id: '20' }, f.ctx);
    expect(r.status).toBe('needs_clarification');
    if (r.status === 'needs_clarification')
      expect(r.missingFields).toEqual(['platform_policy']);
  });
  it('uses the frozen platform policy and rejects replacing it', async () => {
    const f = fixture(),
      input = f.forAction('confirm');
    f.target.policy_snapshot = {
      schema_version: 1,
      kind: 'platform',
      channel: 'airbnb',
      captured_at: '2030-04-01T00:00:00.000Z',
      timezone: 'UTC',
      platform_reference: 'anterior',
      platform_description: 'Original',
      resolution: 'manual_external',
    };
    await expect(f.ready('confirm', input)).rejects.toThrow(
      'agreement_immutable',
    );
  });
  it('rejects occupancy, missing same-day plan and foreign approval IDs', async () => {
    const f = fixture(),
      input = f.forAction('confirm');
    f.calendar.conflicts = [{ id: '40', resource_type: 'block' }];
    await expect(f.ready('confirm', input)).rejects.toThrow(
      'availability_conflict',
    );
    f.calendar.conflicts = [];
    f.calendar.turnover_requirements = [
      {
        incoming_reservation_id: '20',
        turnover_id: '30',
        needs_approval: true,
        plan_valid: false,
      },
    ];
    f.calendar.previous = {
      id: '19',
      status: 'completed',
      check_in_on: '2030-05-01',
      check_out_on: '2030-05-03',
      starts_at: Date.parse('2030-05-01T15:00:00Z'),
      ends_at: Date.parse('2030-05-03T11:00:00Z'),
    };
    await expect(
      f.ready('confirm', { ...input, same_day_approvals: ['30'] }),
    ).rejects.toThrow('turnover_required');
    f.calendar.turnover_requirements = [];
    f.calendar.previous = null;
    await expect(
      f.ready('confirm', { ...input, same_day_approvals: ['31'] }),
    ).rejects.toThrow('invalid_approval');
  });
  it('refreshes the next stay predecessor before validating an explicit same-day approval', async () => {
    const f = fixture(),
      input = f.forAction('confirm');
    f.calendar.next = {
      id: '21',
      status: 'confirmed',
      check_in_on: '2030-05-05',
      check_out_on: '2030-05-07',
      starts_at: Date.parse('2030-05-05T15:00:00Z'),
      ends_at: Date.parse('2030-05-07T11:00:00Z'),
    };
    f.calendar.turnovers.push({
      id: '31',
      incoming_reservation_id: '21',
      previous_reservation_id: null,
      linen_ready: true,
      cleaning_status: 'pending',
      planned_ready_at: '2030-05-05T13:00:00Z',
      ready_at: null,
      same_day_approved_at: null,
    });
    f.calendar.turnover_requirements = [
      {
        incoming_reservation_id: '21',
        turnover_id: '31',
        needs_approval: true,
        plan_valid: false,
      },
    ];
    await expect(
      f.ready('confirm', { ...input, same_day_approvals: ['31'] }),
    ).resolves.toBeDefined();
    await expect(f.ready('confirm', input)).rejects.toThrow(
      'turnover_required',
    );
  });
  it('shows cancellation refund/retention without creating a refund row and excludes volatile computation times', async () => {
    const f = fixture(),
      { step } = await f.ready('cancel', f.forAction('cancel'));
    expect(step.commandTemplate.command).toMatchObject({
      expected_refund_amount: '0',
    });
    expect(step.publicStep.changes).toEqual(
      expect.arrayContaining(
        [
          'expected_refund_amount',
          'received_amount',
          'retained_amount',
          'balance_due_after_cancellation',
          'refund_due_after_cancellation',
        ].map((field_key) =>
          expect.objectContaining({ field_key, after: '0' }),
        ),
      ),
    );
    expect(JSON.stringify(step.preconditions)).not.toContain('computed_at');
    f.state.now = new Date('2030-05-01T12:30:00Z');
    await expect(
      f.op('cancel').verifyPreconditions(step, f.ctx),
    ).resolves.toBeUndefined();
    expect(f.writers.every((w) => !w.execute.mock.calls.length)).toBe(true);
  });
  it('recomputes derived expected refund after editing a cancellation without permitting manual override', async () => {
    const f = fixture(),
      { port, step } = await f.ready('cancel', f.forAction('cancel'));
    await expect(
      port.applyEdits(
        step.commandTemplate,
        [
          {
            step_id: session,
            field_key: 'expected_refund_amount',
            value: '200',
          },
        ],
        f.ctx,
      ),
    ).rejects.toThrow('invalid_input');
    const edited = await port.applyEdits(
      step.commandTemplate,
      [
        {
          step_id: session,
          field_key: 'cancelled_at',
          value: '2030-05-01T11:00:00Z',
        },
      ],
      f.ctx,
    );
    const next = await port.reprepareStored(edited, f.ctx);
    expect(next.status).toBe('ready');
    if (next.status === 'ready')
      expect(next.commandTemplate.request_key).toBe(
        step.commandTemplate.request_key,
      );
  });
  it.each(['guest', 'ledger', 'turnover', 'property', 'status'] as const)(
    'rejects material %s changes even if timestamps remain unchanged',
    async (field) => {
      const f = fixture();
      const action: Action =
        field === 'ledger'
          ? 'cancel'
          : field === 'turnover'
            ? 'start'
            : field === 'property'
              ? 'create'
              : field === 'status'
                ? 'confirm'
                : 'update';
      const { port, step } = await f.ready(
        action,
        action === 'update'
          ? {
              property_id: '10',
              id: '20',
              notes: 'Cambio',
            }
          : f.forAction(action),
      );
      if (field === 'guest') f.target.guest_name = 'Cambio externo';
      if (field === 'ledger') f.state.hash = 'b'.repeat(64);
      if (field === 'turnover') f.calendar.turnovers[0].linen_ready = false;
      if (field === 'property') f.property.max_guests = 7;
      if (field === 'status') f.target.status = 'cancelled';
      await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
        'preconditions_changed',
      );
      expect(f.writers.every((w) => !w.execute.mock.calls.length)).toBe(true);
    },
  );
  it.each(['update', 'start', 'complete'] as const)(
    'does not freeze unrelated money/calendar/settings for %s',
    async (action) => {
      const f = fixture(),
        { port, step } = await f.ready(action, f.forAction(action));
      f.state.received = '10000';
      f.state.hasMoney = true;
      f.state.hash = 'b'.repeat(64);
      if (action !== 'start') {
        f.calendar.turnovers[0].linen_ready = false;
        f.calendar.conflicts.push({ id: '50', resource_type: 'reservation' });
        f.property.max_guests = 2;
      }
      if (action === 'complete') f.property.is_active = false;
      await expect(port.executeConfirmed(step, f.ctx)).resolves.toEqual({
        id: '20',
        propertyId: '10',
      });
      expect(f.store.money).not.toHaveBeenCalled();
      if (action !== 'start') expect(f.store.calendar).not.toHaveBeenCalled();
    },
  );
  it('validates unpaid draft metadata against native capacity and policy without freezing irrelevant money', async () => {
    const f = fixture();
    f.property.max_guests = 1;
    await expect(
      f.ready('update', { property_id: '10', id: '20', notes: 'Cambio' }),
    ).rejects.toThrow('capacity_exceeded');
    f.property.max_guests = 6;
    f.target.cancellation_policy_id = '40';
    await expect(
      f.ready('update', { property_id: '10', id: '20', notes: 'Cambio' }),
    ).rejects.toThrow('not_found');
    f.state.hasMoney = true;
    await expect(
      f.ready('update', { property_id: '10', id: '20', notes: 'Cambio' }),
    ).resolves.toBeDefined();
  });
  it('revalidates turnover facts and the arrival/departure clock on start', async () => {
    const f = fixture(),
      { port, step } = await f.ready('start', f.forAction('start'));
    f.calendar.turnovers[0].ready_at = '2030-05-03T17:00:00.000Z';
    await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
      'preconditions_changed',
    );
    const g = fixture(),
      ready = await g.ready('start', g.forAction('start'));
    g.state.now = new Date('2030-05-05T11:00:00Z');
    await expect(
      ready.port.executeConfirmed(ready.step, g.ctx),
    ).rejects.toThrow('preconditions_changed');
  });
  it('permits completing an existing stay in an archived house but rejects new drafts and starts there', async () => {
    const f = fixture();
    f.property.is_active = false;
    await expect(f.ready('create', create)).rejects.toThrow(
      'property_inactive',
    );
    await expect(f.ready('start', f.forAction('start'))).rejects.toThrow(
      'property_inactive',
    );
    await expect(
      f.ready('complete', f.forAction('complete')),
    ).resolves.toBeDefined();
  });
  it.each(['module', 'session', 'member'] as const)(
    'rechecks %s authority and never trusts persisted actor flags',
    async (reason) => {
      const f = fixture(),
        { port, step } = await f.ready('update', {
          property_id: '10',
          id: '20',
          notes: 'Cambio',
        });
      if (reason === 'module') (f.ctx.moduleRoutes as string[]).splice(0);
      if (reason === 'session') f.state.authenticated = false;
      if (reason === 'member') f.property.owner_id = '2';
      await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
        reason === 'module'
          ? 'capability_denied'
          : reason === 'session'
            ? 'session_expired'
            : 'not_found',
      );
      expect(f.writers[1].execute).not.toHaveBeenCalled();
    },
  );
  it('accepts native collaborators and super_admin while preserving the real actor', async () => {
    for (const superAdmin of [false, true]) {
      const f = fixture();
      f.property.owner_id = '2';
      f.state.superAdmin = superAdmin;
      f.state.member = !superAdmin;
      const { port, step } = await f.ready('update', {
        property_id: '10',
        id: '20',
        notes: 'Cambio',
      });
      await port.executeConfirmed(step, f.ctx);
      expect(f.writers[1].execute.mock.calls[0]?.[0]).toMatchObject({
        userId: '1',
        transaction: f.manager,
      });
    }
  });
  it.each(actions)(
    'dispatches %s using the same transaction and fixed native request key',
    async (action) => {
      const f = fixture(),
        { port, step } = await f.ready(action, f.forAction(action));
      await expect(port.executeConfirmed(step, f.ctx)).resolves.toEqual({
        id: action === 'create' ? '99' : '20',
        propertyId: '10',
      });
      const args = f.writers[actions.indexOf(action)].execute.mock.calls[0]!;
      expect(args[0]).toMatchObject({
        userId: '1',
        sessionId: session,
        transaction: f.manager,
        statementTimeoutMs: 1200,
      });
      expect(args.at(-1)).toBe(step.commandTemplate.request_key);
    },
  );
  it('rejects wrong native receipt scope and output shape', async () => {
    const f = fixture(),
      { port, step } = await f.ready('update', {
        property_id: '10',
        id: '20',
        notes: 'Cambio',
      });
    f.writers[1].execute.mockImplementationOnce(async () => ({
      operation: 'reservation.update',
      property_id: '11',
      resource_id: '20',
      resource_type: 'reservation',
      status: 'draft',
      updated_at: '2030-05-01T12:00:00Z',
    }));
    await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
      'invalid_output',
    );
  });
});
