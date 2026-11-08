import { describe, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { EntityManager } from 'typeorm';
import { UpdateFinanceMovementUseCase } from '../../finance-movement/use-case/update-finance-movement.use-case.js';
import { DeleteFinanceMovementUseCase } from '../../finance-movement/use-case/delete-finance-movement.use-case.js';
import { CreateFinanceObligationUseCase } from '../../finance-obligation/use-case/create-finance-obligation.use-case.js';
import { UpdateFinanceObligationUseCase } from '../../finance-obligation/use-case/update-finance-obligation.use-case.js';
import { DeleteFinanceObligationUseCase } from '../../finance-obligation/use-case/delete-finance-obligation.use-case.js';
import { ledgerFixture } from '../../finance-obligation/use-case/finance-ledger.fixtures.js';
import type {
  ProposalPreparation,
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { BuildNodiaAiFinanceLedgerOperationsUseCase } from './build-nodia-ai-finance-ledger-operations.use-case.js';

function fixture() {
  const base = ledgerFixture();
  base.category.updated_at = new Date('2026-10-17T00:00:00.000Z');
  const query = vi.fn(async (sql: string) =>
    sql.includes('COUNT(*)')
      ? [
          {
            count: [...base.records.values()]
              .filter(
                (row) =>
                  row.obligation_id === base.obligation.id &&
                  row.type ===
                    (base.obligation.type === 'loan' ? 'income' : 'expense'),
              )
              .length.toString(),
          },
        ]
      : [],
  );
  Object.assign(base.manager, {
    queryRunner: { isTransactionActive: true },
    query,
  });
  const hasRepayments = vi.fn(async () =>
    [...base.records.values()].some(
      (row) =>
        row.obligation_id === base.obligation.id &&
        row.type === (base.obligation.type === 'loan' ? 'income' : 'expense'),
    ),
  );
  const deleteMovement = vi.fn(
    async (_manager: EntityManager, _owner: string, id: string) => {
      base.records.delete(id);
    },
  );
  const deleteObligation = vi.fn(async () => undefined);
  Object.assign(base.ledger, {
    hasRepayments,
    deleteMovement,
    deleteObligation,
  });
  const update = new UpdateFinanceMovementUseCase(
    base.ledgerService,
    base.movementService,
  );
  const createObligation = new CreateFinanceObligationUseCase(
    base.ledgerService,
  );
  const updateObligation = new UpdateFinanceObligationUseCase(
    base.ledgerService,
  );
  const removeMovement = new DeleteFinanceMovementUseCase(base.ledgerService);
  const removeObligation = new DeleteFinanceObligationUseCase(
    base.ledgerService,
  );
  const factory = new BuildNodiaAiFinanceLedgerOperationsUseCase(
    base.ledgerService,
    update,
    removeMovement,
    createObligation,
    updateObligation,
    removeObligation,
  );
  const operation = (
    resource: 'movements' | 'obligations',
    action: 'create' | 'update' | 'delete',
  ) =>
    factory.operations.find(
      (item) => item.toolName === `nodia_finance_${resource}_prepare_${action}`,
    )!;
  const context = {
    manager: base.manager,
    actor: { actorId: '1', sessionId: 'session-1' },
    moduleRoutes: ['/finances-personal'],
    conversationId: 'chat-1',
    statementTimeoutMs: 1000,
  } as ProposalPreparerContext;
  const create = {
    name: ' New loan ',
    key: 'new-loan',
    type: 'loan',
    amount: '9007199254740993',
    category_id: '2',
  } satisfies NodiaAiJsonObject;
  return {
    ...base,
    factory,
    operation,
    context,
    query,
    hasRepayments,
    deleteMovement,
    deleteObligation,
    create,
  };
}
function stored(
  result: ProposalPreparation,
  operation: ReturnType<ReturnType<typeof fixture>['operation']>,
): StoredProposalStep {
  if (result.status !== 'ready') throw new Error('expected-ready');
  return {
    ...result,
    id: 'step-1',
    toolName: operation.toolName,
    contractHash: operation.contractHash,
    position: 0,
    outputBindings: [],
  };
}
function change(result: ProposalPreparation, key: string) {
  if (result.status !== 'ready') throw new Error('expected-ready');
  const found = (result.publicStep.changes as NodiaAiJsonObject[]).find(
    (field) => field.field_key === key,
  );
  function unpack(value: unknown): unknown {
    if (
      value &&
      typeof value === 'object' &&
      'kind' in value &&
      value.kind === 'object' &&
      'fields' in value &&
      Array.isArray(value.fields)
    )
      return Object.fromEntries(
        value.fields.map((field: { field_key: string; value: unknown }) => [
          field.field_key,
          unpack(field.value),
        ]),
      );
    return value;
  }
  return found === undefined
    ? undefined
    : { ...found, before: unpack(found.before), after: unpack(found.after) };
}

describe('BuildNodiaAiFinanceLedgerOperationsUseCase', () => {
  it('all five public previews satisfy the actual common PublicStep schema, including structured side effects', async () => {
    const f = fixture();
    const sourceJson = readFileSync(
      new URL(
        '../../nodia-ai-tools/config/common-schema.json',
        import.meta.url,
      ),
      'utf8',
    );
    const { validate } = compileNodiaAiToolSchema({
      sourceJson,
      definition: 'PublicStep',
      sha256: createHash('sha256').update(sourceJson).digest('hex'),
    });
    const cases = [
      [f.operation('obligations', 'create'), f.create],
      [f.operation('obligations', 'update'), { id: '3', amount: '110000' }],
      [f.operation('movements', 'update'), { id: '5', name: 'Edited' }],
      [f.operation('movements', 'delete'), { id: '5' }],
    ] as const;
    for (const [op, input] of cases) {
      const result = await op.prepare(input, f.context);
      if (result.status !== 'ready') throw new Error('expected-ready');
      expect(
        validate({ ...result.publicStep, step_id: randomUUID() }),
        JSON.stringify(validate.errors),
      ).toBe(true);
    }
    f.records.delete('5');
    const deletion = await f
      .operation('obligations', 'delete')
      .prepare({ id: '3' }, f.context);
    if (deletion.status !== 'ready') throw new Error('expected-ready');
    expect(
      validate({ ...deletion.publicStep, step_id: randomUUID() }),
      JSON.stringify(validate.errors),
    ).toBe(true);
  });
  it('scoped duplicate key fails preparation and a collision after review invalidates the snapshot', async () => {
    const f = fixture(),
      op = f.operation('obligations', 'create');
    const step = stored(await op.prepare(f.create, f.context), op);
    f.query.mockResolvedValue([{ id: '9' }] as never);
    await expect(op.prepare(f.create, f.context)).rejects.toThrow(
      'finance:duplicate_key',
    );
    await expect(op.verifyPreconditions(step, f.context)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
    expect(f.ledger.saveObligation).not.toHaveBeenCalled();
  });
  it('registers five unique exact local ports with scalar typed editors and no generic bindings', () => {
    const f = fixture();
    expect(f.factory.operations).toHaveLength(5);
    expect(
      new Set(f.factory.operations.map((item) => item.toolName)).size,
    ).toBe(5);
    for (const op of f.factory.operations) {
      expect(op.contractHash).toMatch(/^[a-f0-9]{64}$/);
      expect(op.catalogVersion).toBe('nodia-ai-ai21-finance/1');
      expect(op.bindableFields).toEqual({});
      expect(
        op.reviewFields?.some(
          (field) => field.field_key === 'id' || field.field_key === 'owner_id',
        ),
      ).toBe(false);
    }
  });
  it('clarifies missing create fields and target identity instead of inventing data', async () => {
    const f = fixture();
    expect(
      await f
        .operation('obligations', 'create')
        .prepare({ name: 'Loan' }, f.context),
    ).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['key', 'type', 'amount', 'category_id'],
    });
    expect(
      await f.operation('movements', 'delete').prepare({}, f.context),
    ).toMatchObject({ status: 'needs_clarification', missingFields: ['id'] });
    expect(f.ledger.saveMovement).not.toHaveBeenCalled();
    expect(f.ledger.saveObligation).not.toHaveBeenCalled();
  });
  it('creates a frozen preview of the automatic initial movement and exact bigint remaining balance', async () => {
    const f = fixture(),
      op = f.operation('obligations', 'create');
    const result = await op.prepare(f.create, f.context);
    expect(result).toMatchObject({
      status: 'ready',
      commandTemplate: {
        owner_id: '1',
        command: { name: 'New loan', description: null, is_active: true },
        origins: {
          description: 'contract_default',
          is_active: 'contract_default',
          name: 'user',
        },
      },
    });
    expect(change(result, 'initial_movement')).toMatchObject({
      before_present: false,
      after: { type: 'expense', status: 'paid', amount: '9007199254740993' },
    });
    expect(change(result, 'remaining_amount')?.after).toBe('9007199254740993');
    expect(f.ledger.saveMovement).not.toHaveBeenCalled();
  });
  it('debt creates income/received and preserves explicit false and nullable description', async () => {
    const f = fixture();
    const result = await f
      .operation('obligations', 'create')
      .prepare(
        { ...f.create, type: 'debt', description: null, is_active: false },
        f.context,
      );
    expect(change(result, 'initial_movement')?.after).toMatchObject({
      type: 'income',
      status: 'received',
      is_active: false,
    });
    expect(change(result, 'description')?.origin).toBe('user');
  });
  it.each([
    { name: null },
    { amount: 20 },
    { amount: '9223372036854775808' },
    { category_id: null },
    { description: 5 },
    { is_active: null },
    { user_id: '2' },
    { id: '7' },
    { remaining_amount: '0' },
  ])('rejects invalid create/unknown identity fields %j', async (values) => {
    const f = fixture();
    await expect(
      f
        .operation('obligations', 'create')
        .prepare({ ...f.create, ...values } as NodiaAiJsonObject, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('rejects immutable obligation type/category and movement obligation reassignment', async () => {
    const f = fixture();
    await expect(
      f
        .operation('obligations', 'update')
        .prepare({ id: '3', type: 'debt' }, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      f
        .operation('obligations', 'update')
        .prepare({ id: '3', category_id: '2' }, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      f
        .operation('movements', 'update')
        .prepare({ id: '5', obligation_id: null }, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('preserves partial updates, supplied null and excludes unrelated native fields from changes', async () => {
    const f = fixture();
    const result = await f
      .operation('obligations', 'update')
      .prepare({ id: '3', description: null, is_active: false }, f.context);
    expect(result).toMatchObject({
      status: 'ready',
      commandTemplate: {
        id: '3',
        command: { description: null, is_active: false },
      },
    });
    expect(change(result, 'name')).toBeUndefined();
    expect(change(result, 'description')?.after_present).toBe(true);
  });
  it('clarification merges only the same owner and immutable target', async () => {
    const f = fixture(),
      op = f.operation('movements', 'update');
    const draft = await op.prepare(
      { name: 'Edited', owner_id: '1' },
      f.context,
    );
    if (draft.status !== 'needs_clarification')
      throw new Error('expected-draft');
    const ready = await op.prepare({ id: '5' }, f.context, draft.partial);
    expect(ready).toMatchObject({
      status: 'ready',
      commandTemplate: { id: '5', command: { name: 'Edited' } },
    });
    await expect(
      op.prepare({ owner_id: '2', id: '5' }, f.context, draft.partial),
    ).rejects.toThrow('nodia_ai:invalid_input');
    if (ready.status !== 'ready') throw new Error('expected-ready');
    await expect(
      op.prepare({ id: '4' }, f.context, ready.commandTemplate),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('native ordinary confirmed direction correction remains supported without reopening pending/cancelled', async () => {
    const f = fixture();
    f.payment.obligation_id = null;
    const result = await f
      .operation('movements', 'update')
      .prepare({ id: '5', type: 'expense', status: 'paid' }, f.context);
    expect(result.status).toBe('ready');
    await expect(
      f
        .operation('movements', 'update')
        .prepare({ id: '5', type: 'expense' }, f.context),
    ).rejects.toThrow('finance:invalid_movement_state');
    await expect(
      f
        .operation('movements', 'update')
        .prepare({ id: '5', status: 'pending' }, f.context),
    ).rejects.toThrow('finance:invalid_status_transition');
  });
  it('asks which changes are requested for empty updates instead of producing a timestamp-only effect', async () => {
    const f = fixture();
    for (const resource of ['movements', 'obligations'] as const) {
      const op = f.operation(resource, 'update');
      expect(
        await op.prepare(
          { id: resource === 'movements' ? '5' : '3' },
          f.context,
        ),
      ).toMatchObject({
        status: 'needs_clarification',
        missingFields: ['changes'],
      });
    }
    expect(f.ledger.movement).not.toHaveBeenCalled();
    expect(f.ledger.obligation).not.toHaveBeenCalled();
  });
  it('existing inactive category and obligation allow nonfinancial edits', async () => {
    const f = fixture();
    f.category.is_active = false;
    f.obligation.is_active = false;
    expect(
      (
        await f
          .operation('movements', 'update')
          .prepare({ id: '5', name: 'Renamed' }, f.context)
      ).status,
    ).toBe('ready');
    await expect(
      f.operation('obligations', 'create').prepare(f.create, f.context),
    ).rejects.toThrow('finance:inactive_category');
  });
  it('blocks initial amount edits/direct deletion and changes to a linked direction', async () => {
    const f = fixture();
    await expect(
      f
        .operation('movements', 'update')
        .prepare({ id: '4', amount: '100001' }, f.context),
    ).rejects.toThrow('finance:edit_principal_on_obligation');
    await expect(
      f.operation('movements', 'delete').prepare({ id: '4' }, f.context),
    ).rejects.toThrow('finance:delete_initial_on_obligation');
    await expect(
      f
        .operation('movements', 'update')
        .prepare({ id: '5', type: 'expense', status: 'paid' }, f.context),
    ).rejects.toThrow('finance:invalid_status_transition');
  });
  it('previews initial amount propagation and paid/remaining values using exact integer strings', async () => {
    const f = fixture();
    const result = await f
      .operation('obligations', 'update')
      .prepare({ id: '3', amount: '9007199254740993' }, f.context);
    expect(change(result, 'initial_movement.amount')).toMatchObject({
      before: '100000',
      after: '9007199254740993',
    });
    expect(change(result, 'paid_amount')).toMatchObject({
      before: '20000',
      after: '20000',
    });
    expect(change(result, 'remaining_amount')).toMatchObject({
      before: '80000',
      after: '9007199254720993',
    });
    await expect(
      f
        .operation('obligations', 'update')
        .prepare({ id: '3', amount: '19999' }, f.context),
    ).rejects.toThrow('finance:principal_below_payments');
  });
  it('previews payment cancellation/deletion balance and retains archive contribution', async () => {
    const f = fixture();
    const cancelled = await f
      .operation('movements', 'update')
      .prepare({ id: '5', status: 'cancelled' }, f.context);
    const deleted = await f
      .operation('movements', 'delete')
      .prepare({ id: '5' }, f.context);
    const archived = await f
      .operation('movements', 'update')
      .prepare({ id: '5', is_active: false }, f.context);
    expect(change(cancelled, 'paid_amount')?.after).toBe('0');
    expect(change(deleted, 'remaining_amount')?.after).toBe('100000');
    expect(change(archived, 'paid_amount')?.after).toBe('20000');
  });
  it('rejects overpayment and initial cancellation while paid, preserving native failure reasons', async () => {
    const f = fixture();
    await expect(
      f
        .operation('movements', 'update')
        .prepare({ id: '5', amount: '100001' }, f.context),
    ).rejects.toThrow('finance:overpayment');
    await expect(
      f
        .operation('movements', 'update')
        .prepare({ id: '4', status: 'cancelled' }, f.context),
    ).rejects.toThrow('finance:initial_has_payments');
  });
  it.each(['pending', 'cancelled', 'received'] as const)(
    'any repayment protects obligation deletion, including %s inactive rows',
    async (status) => {
      const f = fixture();
      f.payment.status = status;
      f.payment.is_active = false;
      await expect(
        f.operation('obligations', 'delete').prepare({ id: '3' }, f.context),
      ).rejects.toThrow('finance:obligation_has_payments');
    },
  );
  it('safe obligation deletion preview explicitly includes the initial movement removal', async () => {
    const f = fixture();
    f.records.delete('5');
    const result = await f
      .operation('obligations', 'delete')
      .prepare({ id: '3' }, f.context);
    expect(change(result, 'initial_movement')).toMatchObject({
      before: { id: '4', amount: '100000' },
      after_present: false,
    });
    expect(change(result, 'remaining_amount')?.after_present).toBe(false);
  });
  it('authority verification only authorizes the original scope after target deletion', async () => {
    const f = fixture(),
      op = f.operation('movements', 'delete');
    const step = stored(await op.prepare({ id: '5' }, f.context), op);
    f.records.delete('5');
    vi.clearAllMocks();
    await expect(op.verifyAuthority(step, f.context)).resolves.toBeUndefined();
    expect(f.ledger.movement).not.toHaveBeenCalled();
    expect(f.query).not.toHaveBeenCalled();
    await expect(op.verifyPreconditions(step, f.context)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
  });
  it.each([
    'category',
    'target',
    'obligation',
    'initial',
    'payment-count',
  ] as const)(
    'detects material %s changes even when timestamps are unchanged',
    async (kind) => {
      const f = fixture(),
        op = f.operation('movements', 'update');
      const step = stored(
        await op.prepare({ id: '5', name: 'Edited' }, f.context),
        op,
      );
      if (kind === 'category') f.category.name = 'Changed';
      if (kind === 'target') f.payment.name = 'Changed';
      if (kind === 'obligation') f.obligation.key = 'Changed';
      if (kind === 'initial') f.origin.name = 'Changed';
      if (kind === 'payment-count')
        f.records.set('6', { ...f.payment, id: '6', status: 'pending' });
      await expect(op.verifyPreconditions(step, f.context)).rejects.toThrow(
        'nodia_ai:preconditions_changed',
      );
      expect(f.ledger.saveMovement).not.toHaveBeenCalled();
    },
  );
  it('typed field editing rejects identity, duplicates and derived balance fields', async () => {
    const f = fixture(),
      op = f.operation('obligations', 'update');
    const step = stored(
      await op.prepare({ id: '3', name: 'Edited' }, f.context),
      op,
    );
    for (const key of [
      'owner_id',
      'id',
      'initial_movement.amount',
      'paid_amount',
    ])
      await expect(
        op.applyEdits(
          step.commandTemplate,
          [{ step_id: step.id, field_key: key, value: '2' }],
          f.context,
        ),
      ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      op.applyEdits(
        step.commandTemplate,
        [
          { step_id: step.id, field_key: 'name', value: 'First' },
          { step_id: step.id, field_key: 'name', value: 'Second' },
        ],
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(
      await op.applyEdits(
        step.commandTemplate,
        [{ step_id: step.id, field_key: 'description', value: null }],
        f.context,
      ),
    ).toMatchObject({
      id: '3',
      command: { name: 'Edited', description: null },
    });
  });
  it('executes real native update logic under the same manager, preserving omitted fields', async () => {
    const f = fixture(),
      op = f.operation('movements', 'update');
    const step = stored(
      await op.prepare(
        { id: '5', name: 'Edited', is_active: false },
        f.context,
      ),
      op,
    );
    expect(await op.executeConfirmed(step, f.context)).toEqual({
      id: '5',
      ownerId: '1',
    });
    expect(f.records.get('5')).toMatchObject({
      name: 'Edited',
      is_active: false,
      amount: '20000',
      status: 'received',
      obligation_id: '3',
    });
    expect(f.ledger.saveMovement.mock.calls[0][0]).toBe(f.manager);
    expect(f.calls.indexOf('obligation')).toBeLessThan(
      f.calls.indexOf('movement-lock'),
    );
  });
  it('executes native obligation create with its initial movement and defaults in the same transaction', async () => {
    const f = fixture(),
      op = f.operation('obligations', 'create');
    const step = stored(await op.prepare(f.create, f.context), op);
    expect(await op.executeConfirmed(step, f.context)).toEqual({
      id: '3',
      ownerId: '1',
    });
    expect(f.ledger.saveObligation.mock.calls[0][0]).toBe(f.manager);
    expect(f.ledger.saveMovement.mock.calls[0]).toEqual([
      f.manager,
      expect.objectContaining({
        name: 'New loan',
        type: 'expense',
        status: 'paid',
        amount: '9007199254740993',
        category_id: '2',
      }),
    ]);
  });
  it('native obligation amount update propagates only amount to its initial movement', async () => {
    const f = fixture(),
      op = f.operation('obligations', 'update');
    const step = stored(
      await op.prepare(
        { id: '3', amount: '110000', name: 'New principal name' },
        f.context,
      ),
      op,
    );
    await op.executeConfirmed(step, f.context);
    expect(f.records.get('4')).toMatchObject({
      amount: '110000',
      name: 'Loan',
    });
    expect(f.ledger.saveObligation).toHaveBeenCalledWith(
      f.manager,
      expect.objectContaining({ amount: '110000', name: 'New principal name' }),
    );
  });
  it('native delete returns historical target identity without reading the deleted entity', async () => {
    const f = fixture(),
      op = f.operation('movements', 'delete');
    const step = stored(await op.prepare({ id: '5' }, f.context), op);
    expect(await op.executeConfirmed(step, f.context)).toEqual({
      id: '5',
      ownerId: '1',
    });
    expect(f.records.has('5')).toBe(false);
    expect(f.movements.findOne).not.toHaveBeenCalled();
  });
  it('native obligation delete removes initial and obligation under the same manager', async () => {
    const f = fixture();
    f.records.delete('5');
    const op = f.operation('obligations', 'delete');
    const step = stored(await op.prepare({ id: '3' }, f.context), op);
    expect(await op.executeConfirmed(step, f.context)).toEqual({
      id: '3',
      ownerId: '1',
    });
    expect(f.deleteMovement).toHaveBeenCalledWith(f.manager, '1', '4');
    expect(f.deleteObligation).toHaveBeenCalledWith(f.manager, '1', '3');
  });
  it('exact confirmed envelopes reject post-review normalization/defaults/extra fields/dependencies', async () => {
    const f = fixture(),
      op = f.operation('obligations', 'create');
    const step = stored(await op.prepare(f.create, f.context), op);
    await expect(
      op.executeConfirmed(
        {
          ...step,
          commandTemplate: {
            ...step.commandTemplate,
            command: {
              ...(step.commandTemplate.command as NodiaAiJsonObject),
              name: ' Changed ',
            },
          },
        },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      op.executeConfirmed(
        { ...step, publicStep: { ...step.publicStep, depends_on: ['other'] } },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    const removedDefault = structuredClone(step);
    delete (removedDefault.commandTemplate.command as NodiaAiJsonObject)
      .is_active;
    delete (removedDefault.commandTemplate.origins as NodiaAiJsonObject)
      .is_active;
    await expect(
      op.executeConfirmed(removedDefault, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.ledger.saveMovement).not.toHaveBeenCalled();
  });
  it('requires a live transaction and destination module before reading domain', async () => {
    const f = fixture(),
      op = f.operation('movements', 'delete');
    await expect(
      op.prepare({ id: '5' }, { ...f.context, moduleRoutes: [] }),
    ).rejects.toThrow('nodia_ai:capability_denied');
    await expect(
      op.prepare({ id: '5' }, { ...f.context, manager: {} as EntityManager }),
    ).rejects.toThrow('authorization:transaction_required');
    expect(f.ledger.movement).not.toHaveBeenCalled();
  });
});
