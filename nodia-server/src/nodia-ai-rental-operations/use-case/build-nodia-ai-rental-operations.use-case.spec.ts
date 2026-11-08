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
import type { NodiaAiRentalOperationsService } from '../nodia-ai-rental-operations.service.js';
import { BuildNodiaAiRentalOperationsUseCase } from './build-nodia-ai-rental-operations.use-case.js';

const session = '1057a24d-4d46-4ca2-93c3-3711284cfb76';
const tools = [
  'nodia_rental_blocks_prepare_create',
  'nodia_rental_blocks_prepare_update',
  'nodia_rental_turnovers_prepare_update',
  'nodia_rental_turnovers_prepare_approve_same_day',
];
function fixture() {
  const property: NodiaAiJsonObject = {
    id: '10',
    owner_id: '1',
    name: 'Casa',
    timezone: 'UTC',
    minimum_turnover_minutes: 0,
    is_active: true,
  };
  const block: NodiaAiJsonObject = {
    id: '20',
    property_id: '10',
    starts_at: '2030-05-03 12:00:00+00',
    ends_at: '2030-05-03 13:00:00+00',
    reason: 'Obras',
    notes: null,
    is_active: true,
  };
  const turnover: NodiaAiJsonObject = {
    id: '30',
    property_id: '10',
    incoming_reservation_id: '40',
    previous_reservation_id: '39',
    linen_ready: true,
    cleaning_status: 'pending',
    planned_ready_at: '2030-05-03 14:00:00+00',
    ready_at: null,
    same_day_approved_at: null,
    notes: null,
  };
  const transition = {
    incoming: {
      id: '40',
      status: 'draft',
      check_in_on: '2030-05-03',
      check_out_on: '2030-05-05',
      starts_at: Date.parse('2030-05-03T15:00:00Z'),
      ends_at: Date.parse('2030-05-05T11:00:00Z'),
    },
    previous: {
      id: '39',
      status: 'completed',
      check_in_on: '2030-05-01',
      check_out_on: '2030-05-03',
      starts_at: Date.parse('2030-05-01T15:00:00Z'),
      ends_at: Date.parse('2030-05-03T11:00:00Z'),
    },
  };
  const state = {
    actor: '1',
    superAdmin: false,
    authenticated: true,
    member: false,
    exists: true,
    now: new Date('2030-05-01T12:00:00Z'),
  };
  const query = vi.fn(async (sql: string) =>
    sql.startsWith('SELECT u.id') && state.authenticated
      ? [
          {
            actorId: state.actor,
            sessionId: session,
            isSuperAdmin: state.superAdmin,
          },
        ]
      : [],
  );
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const impact: NodiaAiJsonObject[] = [];
  const store = {
    property: vi.fn(async () => structuredClone(property)),
    member: vi.fn(async () => state.member),
    block: vi.fn(async () => (state.exists ? structuredClone(block) : null)),
    turnover: vi.fn(async () =>
      state.exists ? structuredClone(turnover) : null,
    ),
    transition: vi.fn(async () => structuredClone(transition)),
    blockImpact: vi.fn(async () => structuredClone(impact)),
  };
  const writers = tools.map((_, index) => ({
    execute: vi.fn(async (..._args: unknown[]) => ({
      operation:
        index < 2
          ? `block.${index === 0 ? 'create' : 'update'}`
          : `turnover.${index === 2 ? 'update' : 'approve_same_day'}`,
      resource_type: index < 2 ? 'block' : 'turnover',
      resource_id: index === 0 ? '99' : index === 1 ? '20' : '30',
      property_id: '10',
      status: index < 2 ? 'active' : 'pending',
      updated_at: '2030-05-01T12:00:00.000Z',
    })),
  }));
  const factory = new BuildNodiaAiRentalOperationsUseCase(
    store as unknown as NodiaAiRentalOperationsService,
    { now: () => state.now } as RentalClock,
    ...(writers as unknown as ConstructorParameters<
      typeof BuildNodiaAiRentalOperationsUseCase
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
  const args = (index: number): NodiaAiJsonObject =>
    index === 0
      ? {
          property_id: '10',
          starts_at: '2030-05-03T12:00:00Z',
          ends_at: '2030-05-03T13:00:00Z',
          reason: 'Obras',
        }
      : {
          property_id: '10',
          id: index === 1 ? '20' : '30',
          ...(index === 1
            ? { notes: 'Revisado' }
            : index === 2
              ? { linen_ready: false }
              : {}),
        };
  const ready = async (index: number, input = args(index)) => {
    const port = factory.operations[index],
      result = await port.prepare(input, ctx);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('notready');
    const step: StoredProposalStep = {
      ...result,
      id: session,
      toolName: port.toolName,
      contractHash: port.contractHash,
      position: 1,
      outputBindings: [],
    };
    return { port, step };
  };
  return {
    property,
    block,
    turnover,
    transition,
    state,
    manager,
    store,
    impact,
    writers,
    factory,
    ctx,
    args,
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

describe('Build NodiaAI blocks and preparation operations', () => {
  it.each([0, 1, 2, 3])(
    'compiles actual PublicStep and canonical Proposal for port %s',
    async (index) => {
      const f = fixture(),
        { port, step } = await f.ready(index),
        publicStep = { ...step.publicStep, step_id: step.id };
      validator.assert('PublicStep', publicStep);
      const proposal = Object.assign(new NodiaAiProposal(), {
        id: session,
        conversation_id: session,
        actor_id: '1',
        current_revision: 1,
        created_at: f.state.now,
      });
      const revision = Object.assign(new NodiaAiProposalRevision(), {
        proposal_id: session,
        revision: 1,
        state: 'ready',
        hash: '',
        catalog_version: port.catalogVersion,
        canonicalization_version: 'jcs-rfc8785/1',
        created_at: f.state.now,
        expires_at: new Date(f.state.now.getTime() + 900000),
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
  it('asks only real minima without creating a block or a preparation', async () => {
    const f = fixture(),
      result = await f.factory.operations[0].prepare({}, f.ctx);
    expect(result).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['property_id', 'starts_at', 'ends_at', 'reason'],
    });
    expect(f.writers.every((w) => !w.execute.mock.calls.length)).toBe(true);
  });
  it('freezes transforms/defaults and UTC instants before review and dispatch', async () => {
    const f = fixture(),
      { port, step } = await f.ready(0, {
        ...f.args(0),
        starts_at: '2030-05-03T09:00:00-03:00',
        reason: '  Obras  ',
        notes: '  ',
      });
    expect(step.commandTemplate.command).toMatchObject({
      starts_at: '2030-05-03T12:00:00.000Z',
      reason: 'Obras',
      notes: null,
      is_active: true,
    });
    expect(step.commandTemplate.origins).toMatchObject({
      is_active: 'contract_default',
      notes: 'user',
    });
    await port.executeConfirmed(step, f.ctx);
    expect(f.writers[0].execute.mock.calls[0]?.[2]).toEqual(
      step.commandTemplate.command,
    );
    expect(f.writers[0].execute.mock.calls[0]?.[0]).toMatchObject({
      transaction: f.manager,
      statementTimeoutMs: 1200,
      userId: '1',
    });
  });
  it.each([null, false, true])(
    'preserves nullable linen value %s',
    async (linen_ready) => {
      const f = fixture(),
        { step } = await f.ready(2, { ...f.args(2), linen_ready });
      expect(
        (step.commandTemplate.command as NodiaAiJsonObject).linen_ready,
      ).toBe(linen_ready);
    },
  );
  it.each([
    ['is_active', null],
    ['starts_at', null],
    ['reason', ''],
    ['reason', null],
    ['is_active', 'false'],
    ['starts_at', '2030-05-03'],
  ])('rejects invalid block field %s=%s', async (key, value) => {
    const f = fixture();
    await expect(
      f.ready(0, { ...f.args(0), [key as string]: value }),
    ).rejects.toThrow();
  });
  it.each([
    { linen_ready: 0 },
    { cleaning_status: null },
    { cleaning_status: 'done' },
    { previous_reservation_id: '9' },
    { same_day_approved_at: '2030-05-01T12:00:00Z' },
    { incoming_reservation_id: '55' },
  ])('rejects unknown/forged preparation command %j', async (patch) => {
    const f = fixture();
    await expect(
      f.ready(2, {
        property_id: '10',
        id: '30',
        ...patch,
      } as NodiaAiJsonObject),
    ).rejects.toThrow();
  });
  it('approves the future same-day plan without completing cleaning or inventing readiness', async () => {
    const f = fixture(),
      { port, step } = await f.ready(3);
    expect(step.preconditions.derived).toEqual({
      timezone: 'UTC',
      same_day_approval: true,
    });
    expect(step.commandTemplate.command).toEqual({});
    f.state.now = new Date('2030-05-01T13:00:00Z');
    await expect(
      port.verifyPreconditions(step, f.ctx),
    ).resolves.toBeUndefined();
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({ field_key: 'same_day_approval', after: true }),
    );
    expect(f.turnover.cleaning_status).toBe('pending');
    expect(f.turnover.ready_at).toBeNull();
  });
  it.each(['in_progress', 'completed', 'cancelled'])(
    'does not approve a %s incoming stay',
    async (status) => {
      const f = fixture();
      f.transition.incoming.status = status;
      await expect(f.ready(3)).rejects.toThrow('rental:invalid_transition');
    },
  );
  it('zero minimum does not bypass linen or actual local-day approval conditions', async () => {
    const f = fixture();
    f.turnover.linen_ready = false;
    await expect(f.ready(3)).rejects.toThrow('rental:turnover_required');
    f.turnover.linen_ready = true;
    f.transition.previous.check_out_on = '2030-05-02';
    await expect(f.ready(3)).rejects.toThrow('rental:turnover_required');
  });
  it('rejects future readiness and accepts late real readiness separately from planned time', async () => {
    const f = fixture();
    await expect(
      f.ready(2, {
        ...f.args(2),
        linen_ready: true,
        cleaning_status: 'completed',
        ready_at: '2030-05-03T16:00:00Z',
      }),
    ).rejects.toThrow('rental:invalid_turnover_ready');
    f.state.now = new Date('2030-05-03T18:00:00Z');
    const r = await f.ready(2, {
      ...f.args(2),
      linen_ready: true,
      cleaning_status: 'completed',
      ready_at: '2030-05-03T16:00:00Z',
    });
    expect((r.step.commandTemplate.command as NodiaAiJsonObject).ready_at).toBe(
      '2030-05-03T16:00:00.000Z',
    );
  });
  it('new predecessor resets readiness and approval visibly with only notes requested', async () => {
    const f = fixture();
    Object.assign(f.turnover, {
      previous_reservation_id: '38',
      cleaning_status: 'completed',
      ready_at: '2030-05-03T14:00:00Z',
      same_day_approved_at: '2030-05-01T11:00:00Z',
    });
    const { step } = await f.ready(2, {
      property_id: '10',
      id: '30',
      notes: '  Corregido ',
    });
    expect(step.preconditions.derived).toMatchObject({
      previous_reservation_id: '39',
      cleaning_status: 'pending',
      ready_at: null,
      same_day_approved_at: null,
    });
  });
  it('notes-only preserves valid preparation and approval', async () => {
    const f = fixture();
    f.state.now = new Date('2030-05-03T18:00:00Z');
    Object.assign(f.turnover, {
      cleaning_status: 'completed',
      ready_at: '2030-05-03T14:00:00Z',
      same_day_approved_at: '2030-05-01T11:00:00Z',
    });
    const { step } = await f.ready(2, {
      property_id: '10',
      id: '30',
      notes: null,
    });
    expect(step.preconditions.derived).toEqual({ timezone: 'UTC' });
  });
  it('block preview discloses native plan invalidation targets', async () => {
    const f = fixture();
    f.impact.push({
      id: '30',
      cleaning_status: 'completed',
      ready_at: '2030-05-03T12:30:00Z',
      same_day_approved_at: null,
    });
    const { step } = await f.ready(0);
    expect(step.preconditions.derived).toEqual({
      timezone: 'UTC',
      affected_turnover_ids: ['30'],
    });
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'affected_turnover_ids',
        after: { kind: 'array', items: ['30'] },
      }),
    );
  });
  it('block impact ignores unrelated linen and neighbor metadata while freezing actual reset facts', async () => {
    const f = fixture();
    f.impact.push({
      id: '30',
      linen_ready: false,
      incoming_reservation_id: '40',
      previous_reservation_id: '39',
      cleaning_status: 'in_progress',
      planned_ready_at: '2030-05-03T12:30:00Z',
      ready_at: null,
      same_day_approved_at: null,
    });
    const { port, step } = await f.ready(0);
    f.impact[0].linen_ready = true;
    f.impact[0].previous_reservation_id = '38';
    f.impact[0].incoming_reservation_id = '41';
    await expect(
      port.verifyPreconditions(step, f.ctx),
    ).resolves.toBeUndefined();
    f.impact[0].cleaning_status = 'completed';
    await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
  });
  it('metadata block edit and same canonical instant do not inspect or reset calendar plans', async () => {
    const f = fixture();
    await f.ready(1, {
      property_id: '10',
      id: '20',
      starts_at: '2030-05-03T09:00:00-03:00',
      notes: null,
    });
    expect(f.store.blockImpact).not.toHaveBeenCalled();
  });
  it('archived house rejects new blocks yet allows releasing old block and preparation corrections', async () => {
    const f = fixture();
    f.property.is_active = false;
    await expect(f.ready(0)).rejects.toThrow('rental:invalid_transition');
    await expect(
      f.ready(1, { property_id: '10', id: '20', is_active: false }),
    ).resolves.toBeDefined();
    await expect(f.ready(2)).resolves.toBeDefined();
  });
  it.each([0, 1, 2, 3])(
    'revalidates membership, session, module and SA at port %s',
    async (index) => {
      const f = fixture(),
        { port, step } = await f.ready(index);
      f.state.actor = '2';
      await expect(port.verifyAuthority(step, f.ctx)).rejects.toThrow(
        'rental:not_found',
      );
      f.state.member = true;
      await expect(port.verifyAuthority(step, f.ctx)).resolves.toBeUndefined();
      f.state.member = false;
      f.state.superAdmin = true;
      await expect(port.verifyAuthority(step, f.ctx)).resolves.toBeUndefined();
      f.state.authenticated = false;
      await expect(port.verifyAuthority(step, f.ctx)).rejects.toThrow();
      f.state.authenticated = true;
      f.ctx.moduleRoutes = [];
      await expect(port.verifyAuthority(step, f.ctx)).rejects.toThrow(
        'nodia_ai:capability_denied',
      );
    },
  );
  it.each([0, 1, 2, 3])(
    'rejects material stale target/impact without timestamp reliance for port %s',
    async (index) => {
      const f = fixture(),
        { port, step } = await f.ready(index);
      if (index === 0) f.impact.push({ id: '50', same_day_approved_at: null });
      else if (index === 1) f.block.reason = 'Changed';
      else if (index === 2) f.turnover.linen_ready = false;
      else f.turnover.planned_ready_at = '2030-05-03T14:30:00Z';
      await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
        'nodia_ai:preconditions_changed',
      );
      expect(f.writers[index].execute).not.toHaveBeenCalled();
    },
  );
  it.each([0, 1, 2, 3])(
    'unrelated notes do not invalidate a port %s that never proposed editing them',
    async (index) => {
      const f = fixture();
      const input =
        index === 1
          ? { property_id: '10', id: '20', reason: 'Updated label' }
          : f.args(index);
      const { port, step } = await f.ready(index, input);
      f.block.notes = 'Concurrent unrelated note';
      f.turnover.notes = 'Concurrent unrelated note';
      await expect(
        port.verifyPreconditions(step, f.ctx),
      ).resolves.toBeUndefined();
    },
  );
  it.each([1, 2])(
    'a notes edit at port %s still freezes its actual previous notes',
    async (index) => {
      const f = fixture(),
        { port, step } = await f.ready(index, {
          property_id: '10',
          id: index === 1 ? '20' : '30',
          notes: 'Exact correction',
        });
      if (index === 1) f.block.notes = 'Concurrent material note';
      else f.turnover.notes = 'Concurrent material note';
      await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
        'nodia_ai:preconditions_changed',
      );
    },
  );
  it('approval ignores prior guest phase and incoming draft-to-confirmed when native conditions remain identical', async () => {
    const f = fixture(),
      { port, step } = await f.ready(3);
    f.transition.previous.status = 'in_progress';
    f.transition.incoming.status = 'confirmed';
    await expect(
      port.verifyPreconditions(step, f.ctx),
    ).resolves.toBeUndefined();
  });
  it('reprepares with same intention UUID and edits transforms before proposal recompile', async () => {
    const f = fixture(),
      { port, step } = await f.ready(1);
    const edited = await port.applyEdits(
      step.commandTemplate,
      [{ field_key: 'notes', value: '  ' }],
      f.ctx,
    );
    expect(edited.request_key).toBe(step.commandTemplate.request_key);
    expect(edited.command).toMatchObject({ notes: null });
    const ready = await port.reprepareStored(edited, f.ctx);
    expect(ready.status).toBe('ready');
    await expect(
      port.applyEdits(
        edited,
        [{ field_key: 'property_id', value: '20' }],
        f.ctx,
      ),
    ).rejects.toThrow();
  });
  it.each([0, 1, 2, 3])(
    'dispatches exact native result and rejects a foreign result at port %s',
    async (index) => {
      const f = fixture(),
        { port, step } = await f.ready(index);
      await expect(port.executeConfirmed(step, f.ctx)).resolves.toEqual({
        id: index === 0 ? '99' : index === 1 ? '20' : '30',
        propertyId: '10',
      });
      f.writers[index].execute.mockResolvedValueOnce({
        operation: index < 2 ? 'block.update' : 'turnover.update',
        property_id: '11',
        resource_type: 'block',
        resource_id: '20',
        status: 'active',
        updated_at: '2030-05-01T12:00:00.000Z',
      });
      await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
        'nodia_ai:invalid_output',
      );
    },
  );
});
