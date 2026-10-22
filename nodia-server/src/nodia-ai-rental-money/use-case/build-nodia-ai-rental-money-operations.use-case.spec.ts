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
import type { NodiaAiRentalMoneyService } from '../nodia-ai-rental-money.service.js';
import { BuildNodiaAiRentalMoneyOperationsUseCase } from './build-nodia-ai-rental-money-operations.use-case.js';

const session = '1057a24d-4d46-4ca2-93c3-3711284cfb76';
const tools = [
  'payments_create',
  'payments_void',
  'expenses_create',
  'expenses_update',
  'expenses_pay',
  'expenses_void',
] as const;
type Tool = (typeof tools)[number];
const payment: NodiaAiJsonObject = {
  property_id: '10',
  reservation_id: '20',
  type: 'payment',
  amount: '1000',
  occurred_on: '2030-05-01',
};
const expense: NodiaAiJsonObject = {
  property_id: '10',
  name: 'Limpieza',
  amount: '500',
  incurred_on: '2030-05-01',
  status: 'pending',
};
function fixture() {
  const property: NodiaAiJsonObject = {
    id: '10',
    owner_id: '1',
    timezone: 'UTC',
    is_active: true,
  };
  const reservation: NodiaAiJsonObject = {
    id: '20',
    property_id: '10',
    status: 'draft',
    channel: 'whatsapp',
    total_amount: '10000',
    commission_amount: '0',
    deposit_amount: '4000',
    external_reference: null,
    cancellation_policy_id: '30',
    policy_snapshot: null,
    cancelled_at: null,
    refund_amount: null,
  };
  const paymentRow: NodiaAiJsonObject = {
    id: '40',
    property_id: '10',
    reservation_id: '20',
    type: 'payment',
    amount: '1000',
    occurred_on: '2030-05-01',
    status: 'confirmed',
  };
  const expenseRow: NodiaAiJsonObject = {
    id: '50',
    property_id: '10',
    name: 'Limpieza',
    amount: '500',
    incurred_on: '2030-05-01',
    status: 'pending',
    paid_on: null,
    reservation_id: null,
    category: 'Servicios',
    notes: 'Original',
  };
  const state = {
    actor: '1',
    superAdmin: false,
    authenticated: true,
    member: false,
    reservationExists: true,
    targetExists: true,
    received: '4000',
    refunded: '0',
    now: new Date('2030-05-03T12:00:00Z'),
  };
  const policy = {
    id: '30',
    property_id: '10',
    name: 'Condiciones',
    is_active: true,
  };
  const rules = [{ min_days_before: 0, refund_percent: '50.00' }];
  const query = vi.fn(async (sql: string) =>
    sql.startsWith('SELECT u.id')
      ? state.authenticated
        ? [
            {
              actorId: state.actor,
              sessionId: session,
              isSuperAdmin: state.superAdmin,
            },
          ]
        : []
      : [],
  );
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
    getRepository: vi.fn(() => ({
      findOneBy: vi.fn(async () => structuredClone(policy)),
      find: vi.fn(async () => structuredClone(rules)),
    })),
  } as unknown as EntityManager;
  const store = {
    property: vi.fn(async () => structuredClone(property)),
    member: vi.fn(async () => state.member),
    reservation: vi.fn(
      async (_manager: EntityManager, requestedProperty: string, id: string) =>
        state.reservationExists && requestedProperty === '10' && id === '20'
          ? structuredClone(reservation)
          : null,
    ),
    payment: vi.fn(async () =>
      state.targetExists ? structuredClone(paymentRow) : null,
    ),
    expense: vi.fn(async () =>
      state.targetExists ? structuredClone(expenseRow) : null,
    ),
    totals: vi.fn(async () => ({
      received: state.received,
      refunded: state.refunded,
    })),
  };
  const writers = tools.map((tool) => ({
    execute: vi.fn(async (..._args: unknown[]) => {
      const [resource, action] = tool.split('_');
      return {
        operation: `${resource === 'payments' ? 'payment' : 'expense'}.${action}`,
        property_id: '10',
        resource_type: resource === 'payments' ? 'payment' : 'expense',
        resource_id:
          action === 'create' ? '99' : resource === 'payments' ? '40' : '50',
        status:
          action === 'void'
            ? 'voided'
            : action === 'pay'
              ? 'paid'
              : resource === 'payments'
                ? 'confirmed'
                : expenseRow.status,
        updated_at: '2030-05-03T12:00:00Z',
      };
    }),
  }));
  const factory = new BuildNodiaAiRentalMoneyOperationsUseCase(
    store as unknown as NodiaAiRentalMoneyService,
    { now: () => state.now } as RentalClock,
    ...(writers as unknown as ConstructorParameters<
      typeof BuildNodiaAiRentalMoneyOperationsUseCase
    > extends [unknown, unknown, ...infer R]
      ? R
      : never),
  );
  const ctx = {
    actor: { actorId: '1', sessionId: session, isSuperAdmin: false },
    manager,
    moduleRoutes: ['/tools/reservations'],
    actionKeys: [],
    conversationId: session,
    statementTimeoutMs: 1200,
  } as unknown as ProposalPreparerContext;
  const op = (tool: Tool) => factory.operations[tools.indexOf(tool)];
  const input = (tool: Tool): NodiaAiJsonObject =>
    tool === 'payments_create'
      ? { ...payment }
      : tool === 'expenses_create'
        ? { ...expense }
        : {
            property_id: '10',
            id: tool === 'payments_void' ? '40' : '50',
            ...(tool.endsWith('_void')
              ? { reason: 'Error de captura' }
              : tool === 'expenses_pay'
                ? { paid_on: '2030-05-02' }
                : { notes: 'Revisado' }),
          };
  const ready = async (tool: Tool, raw = input(tool)) => {
    const port = op(tool),
      prepared = await port.prepare(raw, ctx);
    expect(prepared.status).toBe('ready');
    if (prepared.status !== 'ready') throw new Error('not ready');
    const step: StoredProposalStep = {
      id: session,
      toolName: port.toolName,
      contractHash: port.contractHash,
      commandTemplate: prepared.commandTemplate,
      preconditions: prepared.preconditions,
      scope: prepared.scope,
      outputBindings: [],
      publicStep: prepared.publicStep,
    };
    return { port, step };
  };
  return {
    property,
    reservation,
    paymentRow,
    expenseRow,
    state,
    policy,
    rules,
    manager,
    query,
    store,
    writers,
    factory,
    ctx,
    op,
    input,
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

describe('Build NodiaAI rental money operations', () => {
  it.each(tools)(
    'compiles the real closed PublicStep and proposal for %s',
    async (tool) => {
      const f = fixture(),
        { port, step } = await f.ready(tool),
        publicStep = { ...step.publicStep, step_id: step.id };
      validator.assert('PublicStep', publicStep);
      const now = f.state.now;
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
    },
  );
  it.each(tools)(
    'dispatches %s with real actor, shared manager, deadline and fixed key',
    async (tool) => {
      const f = fixture(),
        { port, step } = await f.ready(tool);
      await expect(port.executeConfirmed(step, f.ctx)).resolves.toEqual({
        id: tool.endsWith('_create')
          ? '99'
          : tool === 'payments_void'
            ? '40'
            : '50',
        propertyId: '10',
      });
      const args = f.writers[tools.indexOf(tool)].execute.mock.calls[0]!;
      expect(args[0]).toMatchObject({
        userId: '1',
        sessionId: session,
        transaction: f.manager,
        statementTimeoutMs: 1200,
      });
      expect(args.at(-1)).toBe(step.commandTemplate.request_key);
    },
  );
  it('asks payment and expense minimums without inventing status, dates or amount', async () => {
    const f = fixture(),
      a = await f.op('payments_create').prepare({}, f.ctx),
      b = await f.op('expenses_create').prepare({}, f.ctx);
    expect(a.status === 'needs_clarification' && a.missingFields).toEqual([
      'property_id',
      'reservation_id',
      'type',
      'amount',
      'occurred_on',
    ]);
    expect(b.status === 'needs_clarification' && b.missingFields).toEqual([
      'property_id',
      'name',
      'amount',
      'incurred_on',
      'status',
    ]);
    expect(f.writers.every((w) => !w.execute.mock.calls.length)).toBe(true);
  });
  it('requires paid_on only for paid expenses, leaving pending expenses explicitly unpaid', async () => {
    const f = fixture(),
      r = await f
        .op('expenses_create')
        .prepare({ ...expense, status: 'paid' }, f.ctx);
    expect(r.status === 'needs_clarification' && r.missingFields).toEqual([
      'paid_on',
    ]);
    const { step } = await f.ready('expenses_create');
    expect(step.commandTemplate.command).toMatchObject({
      status: 'pending',
      paid_on: null,
      reservation_id: null,
      category: null,
      notes: null,
    });
    expect(step.commandTemplate.origins).toMatchObject({
      status: 'user',
      paid_on: 'contract_default',
    });
  });
  it('trims optional nullable text before public preview and native command identity', async () => {
    const f = fixture(),
      { step } = await f.ready('payments_create', {
        ...payment,
        method: '  efectivo  ',
        reference: '   ',
        notes: '  detalle  ',
      });
    expect(step.commandTemplate.command).toMatchObject({
      method: 'efectivo',
      reference: null,
      notes: 'detalle',
    });
    expect(
      (step.publicStep.changes as NodiaAiJsonObject[]).find(
        (c) => c.field_key === 'reference',
      )?.after,
    ).toBe(null);
  });
  it.each([
    { amount: 100 },
    { amount: '1.2' },
    { amount: '0' },
    { amount: '9223372036854775808' },
    { occurred_on: '2030-02-30' },
    { type: 'pending' },
    { actor_id: '2' },
    { command: { amount: '1' } },
    { request_key: session },
    { status: 'confirmed' },
    { reservation_id: 20 },
    { notes: [] },
  ])('rejects payment mass assignment or malformed input %j', async (patch) => {
    const f = fixture();
    await expect(
      f
        .op('payments_create')
        .prepare({ ...payment, ...patch } as NodiaAiJsonObject, f.ctx),
    ).rejects.toThrow('invalid_input');
  });
  it.each([
    { status: 'voided' },
    { status: null },
    { amount: -1 },
    { paid_on: '2030-05-02' },
    { incurred_on: '2030-05-04' },
  ])('rejects invalid expense capture %j', async (patch) => {
    const f = fixture();
    await expect(
      f
        .op('expenses_create')
        .prepare({ ...expense, ...patch } as NodiaAiJsonObject, f.ctx),
    ).rejects.toThrow('invalid_input');
  });
  it('preserves exact CLP integers above Number.MAX_SAFE_INTEGER', async () => {
    const f = fixture();
    f.reservation.total_amount = '9223372036854775807';
    const { step } = await f.ready('payments_create', {
      ...payment,
      amount: '9007199254740993',
    });
    expect((step.commandTemplate.command as NodiaAiJsonObject).amount).toBe(
      '9007199254740993',
    );
  });
  it('captures direct policy through native validation and stable snapshot, without inventing captured time', async () => {
    const f = fixture(),
      { port, step } = await f.ready('payments_create');
    expect(step.preconditions.policy).toMatchObject({
      policy_id: '30',
      rules: [{ min_days_before: 0, refund_percent: '50.00' }],
    });
    expect(step.preconditions.policy).not.toHaveProperty('captured_at');
    f.state.now = new Date('2030-05-04T12:00:00Z');
    await expect(
      port.verifyPreconditions(step, f.ctx),
    ).resolves.toBeUndefined();
    f.rules[0].refund_percent = '75.00';
    await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
      'preconditions_changed',
    );
  });
  it('asks the first Airbnb payment policy, presents it readonly and forbids an editor bypass', async () => {
    const f = fixture();
    Object.assign(f.reservation, {
      channel: 'airbnb',
      external_reference: 'booking',
      cancellation_policy_id: null,
      deposit_amount: '0',
    });
    const r = await f.op('payments_create').prepare(payment, f.ctx);
    expect(r.status === 'needs_clarification' && r.missingFields).toEqual([
      'platform_policy',
    ]);
    const { port, step } = await f.ready('payments_create', {
      ...payment,
      platform_policy: {
        reference: '  Condiciones  ',
        description: ' Condición externa ',
      },
    });
    expect(step.commandTemplate.command).toHaveProperty('platform_policy', {
      reference: 'Condiciones',
      description: 'Condición externa',
    });
    expect(port.editableFields).not.toHaveProperty('platform_policy');
    expect(
      (step.publicStep.changes as NodiaAiJsonObject[]).find(
        (c) => c.field_key === 'platform_policy',
      )?.after,
    ).toMatchObject({ kind: 'object' });
    await expect(
      port.applyEdits!(
        step.commandTemplate,
        [{ field_key: 'platform_policy', value: {} }],
        f.ctx,
      ),
    ).rejects.toThrow('invalid_input');
  });
  it.each([
    { reference: 'r' },
    { reference: 'r', description: 'd', token: 'secret' },
    null,
  ])('rejects invalid nested platform metadata %j', async (platform_policy) => {
    const f = fixture();
    await expect(
      f
        .op('payments_create')
        .prepare({ ...payment, platform_policy } as NodiaAiJsonObject, f.ctx),
    ).rejects.toThrow('invalid_input');
  });
  it('requires an explicit deposit before accepting money and rejects overpayment', async () => {
    const f = fixture();
    f.reservation.deposit_amount = '0';
    await expect(f.ready('payments_create')).rejects.toThrow(
      'deposit_required',
    );
    f.reservation.deposit_amount = '4000';
    await expect(
      f.ready('payments_create', { ...payment, amount: '6001' }),
    ).rejects.toThrow('overpayment');
  });
  it('records only an approved refund and checks cancellation day and remaining amount', async () => {
    const f = fixture();
    Object.assign(f.reservation, {
      status: 'cancelled',
      cancelled_at: '2030-05-01T12:00:00Z',
      refund_amount: '2000',
    });
    f.state.refunded = '1200';
    await f.ready('payments_create', {
      ...payment,
      type: 'refund',
      amount: '800',
    });
    await expect(
      f.ready('payments_create', { ...payment, type: 'refund', amount: '801' }),
    ).rejects.toThrow('refund_exceeds_approved');
    await expect(
      f.ready('payments_create', {
        ...payment,
        type: 'refund',
        amount: '800',
        occurred_on: '2030-04-30',
      }),
    ).rejects.toThrow('invalid_input');
    await expect(f.ready('payments_create')).rejects.toThrow(
      'invalid_transition',
    );
  });
  it('disallows future money captures in the property zone', async () => {
    const f = fixture();
    f.property.timezone = 'America/Santiago';
    f.state.now = new Date('2030-05-03T01:00:00Z');
    await expect(
      f.ready('payments_create', { ...payment, occurred_on: '2030-05-03' }),
    ).rejects.toThrow('invalid_input');
  });
  it('protects the deposit when voiding confirmed payments and keeps refund void separate', async () => {
    const f = fixture();
    f.reservation.status = 'confirmed';
    await expect(f.ready('payments_void')).rejects.toThrow('deposit_required');
    f.state.received = '5000';
    await f.ready('payments_void');
    f.reservation.status = 'cancelled';
    await expect(f.ready('payments_void')).rejects.toThrow(
      'invalid_transition',
    );
    f.paymentRow.type = 'refund';
    await f.ready('payments_void');
  });
  it.each(['payments_void', 'expenses_void'] as const)(
    'requires a reason and shows the exact affected amount for %s',
    async (tool) => {
      const f = fixture(),
        r = await f
          .op(tool)
          .prepare(
            { property_id: '10', id: tool === 'payments_void' ? '40' : '50' },
            f.ctx,
          );
      expect(r.status === 'needs_clarification' && r.missingFields).toEqual([
        'reason',
      ]);
      const { step } = await f.ready(tool);
      expect(
        (step.publicStep.changes as NodiaAiJsonObject[]).find(
          (c) => c.field_key === 'amount',
        )?.after,
      ).toBe(tool === 'payments_void' ? '1000' : '500');
    },
  );
  it('allows pending changes but never rewrites paid amounts or dates', async () => {
    const f = fixture();
    await f.ready('expenses_update', {
      property_id: '10',
      id: '50',
      amount: '750',
    });
    f.expenseRow.status = 'paid';
    f.expenseRow.paid_on = '2030-05-02';
    await f.ready('expenses_update');
    await expect(
      f.ready('expenses_update', {
        property_id: '10',
        id: '50',
        amount: '750',
      }),
    ).rejects.toThrow('agreement_immutable');
    await expect(f.ready('expenses_pay')).rejects.toThrow('invalid_transition');
    await f.ready('expenses_void');
  });
  it('validates expense reservation association within the same property', async () => {
    const f = fixture();
    await f.ready('expenses_create', { ...expense, reservation_id: '20' });
    await expect(
      f.ready('expenses_create', { ...expense, reservation_id: '21' }),
    ).rejects.toThrow('not_found');
  });
  it.each(tools)(
    'allows %s for archived houses while preserving financial history',
    async (tool) => {
      const f = fixture();
      f.property.is_active = false;
      await f.ready(tool);
    },
  );
  it.each(['module', 'session', 'member'] as const)(
    'rechecks %s before executing a confirmed proposal',
    async (reason) => {
      const f = fixture(),
        { port, step } = await f.ready('expenses_pay');
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
      expect(f.writers[4].execute).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    'keeps actor and ownership distinct for collaborator/super_admin=%s',
    async (superAdmin) => {
      const f = fixture();
      f.property.owner_id = '2';
      f.state.member = !superAdmin;
      f.state.superAdmin = superAdmin;
      const { port, step } = await f.ready('expenses_pay');
      await port.executeConfirmed(step, f.ctx);
      expect(f.writers[4].execute.mock.calls[0]?.[0]).toMatchObject({
        userId: '1',
        transaction: f.manager,
      });
      expect(f.property.owner_id).toBe('2');
    },
  );
  it('invalidates when material totals change even without timestamps', async () => {
    const f = fixture(),
      { port, step } = await f.ready('payments_create');
    f.state.received = '4001';
    await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
      'preconditions_changed',
    );
  });
  it('does not invalidate a financial intent for property archive or unrelated reservation metadata', async () => {
    const f = fixture(),
      { port, step } = await f.ready('payments_create');
    f.property.is_active = false;
    f.reservation.guest_name = 'Cambio';
    f.reservation.notes = 'Otra nota';
    await expect(
      port.verifyPreconditions(step, f.ctx),
    ).resolves.toBeUndefined();
  });
  it.each(['expenses_pay', 'expenses_void'] as const)(
    'ignores unrelated notes/category for %s but detects money changes',
    async (tool) => {
      const f = fixture(),
        { port, step } = await f.ready(tool);
      f.expenseRow.notes = 'Otra';
      f.expenseRow.category = 'Nueva';
      await expect(
        port.verifyPreconditions(step, f.ctx),
      ).resolves.toBeUndefined();
      f.expenseRow.amount = '501';
      await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
        'preconditions_changed',
      );
    },
  );
  it('merges clarifications preserving key and forbids scope replacement', async () => {
    const f = fixture(),
      partial = await f
        .op('expenses_create')
        .prepare({ name: 'Compra' }, f.ctx);
    if (partial.status !== 'needs_clarification')
      throw new Error('expected partial');
    const next = await f
      .op('expenses_create')
      .prepare({ ...expense, name: 'Compra' }, f.ctx, partial.partial);
    expect(next.status === 'ready' && next.commandTemplate.request_key).toBe(
      partial.partial.request_key,
    );
    const { port, step } = await f.ready('expenses_pay');
    await expect(
      port.prepare(
        { property_id: '11', paid_on: '2030-05-02' },
        f.ctx,
        step.commandTemplate,
      ),
    ).rejects.toThrow('invalid_input');
  });
  it('rejects duplicate edits and immutable nested metadata', async () => {
    const f = fixture(),
      { port, step } = await f.ready('expenses_pay');
    await expect(
      port.applyEdits!(
        step.commandTemplate,
        [
          { field_key: 'paid_on', value: '2030-05-02' },
          { field_key: 'paid_on', value: '2030-05-01' },
        ],
        f.ctx,
      ),
    ).rejects.toThrow('invalid_input');
  });
  it('rejects a mismatched native receipt without accepting an effect reference', async () => {
    const f = fixture(),
      { port, step } = await f.ready('expenses_pay');
    f.writers[4].execute.mockImplementationOnce(async () => ({
      operation: 'expense.pay',
      property_id: '11',
      resource_type: 'expense',
      resource_id: '50',
      status: 'paid',
      updated_at: '2030-05-03T12:00:00Z',
    }));
    await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
      'invalid_output',
    );
  });
});
