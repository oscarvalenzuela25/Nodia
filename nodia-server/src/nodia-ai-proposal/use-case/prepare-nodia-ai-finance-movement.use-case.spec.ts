import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';
import { FinanceObligation } from '../../finance-obligation/entities/finance-obligation.entity.js';
import { FinanceMovement } from '../../finance-movement/entities/finance-movement.entity.js';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../types/proposal-preparer.types.js';
import { PrepareNodiaAiFinanceMovementUseCase } from './prepare-nodia-ai-finance-movement.use-case.js';

const command = {
  name: '  Comida  ',
  amount: '20000',
  type: 'expense',
  status: 'paid',
  category_id: '7',
};
function fixture() {
  let superAdmin = false;
  let authenticated = true;
  let ownerExists = true;
  const date = new Date('2026-10-16T12:00:00.000Z');
  const category = Object.assign(new FinanceCategory(), {
    id: '7',
    user_id: '1',
    name: 'Comida',
    key: 'food',
    is_active: true,
    updated_at: date,
  });
  const obligation = Object.assign(new FinanceObligation(), {
    id: '8',
    user_id: '1',
    type: 'debt',
    amount: '50000',
    is_active: true,
    updated_at: date,
  });
  const initial = Object.assign(new FinanceMovement(), {
    id: '9',
    user_id: '1',
    obligation_id: '8',
    type: 'income',
    status: 'received',
  });
  let paid = '10000';
  const findOne = vi.fn(
    async (options: { where: { id: string; user_id: string } }) => {
      const item =
        options.where.id === category.id
          ? category
          : options.where.id === obligation.id
            ? obligation
            : null;
      return item?.user_id === options.where.user_id ? item : null;
    },
  );
  const find = vi.fn(async () => [initial]);
  const save = vi.fn(() => {
    throw new Error('No domain writer may run');
  });
  const builder = {
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getRawOne: vi.fn(async () => ({ amount: paid })),
  };
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith('SELECT u.id'))
      return authenticated
        ? [
            {
              actorId: '1',
              sessionId: '11111111-1111-4111-8111-111111111111',
              isSuperAdmin: superAdmin,
            },
          ]
        : [];
    if (sql.startsWith('SELECT EXISTS')) return [{ exists: ownerExists }];
    return [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
    getRepository: vi.fn(() => ({
      findOne,
      find,
      save,
      createQueryBuilder: () => builder,
    })),
  } as unknown as EntityManager;
  const source = {
    transaction: vi.fn(() => {
      throw new Error('No independent transaction');
    }),
  } as unknown as DataSource;
  const ledger = new FinanceLedgerService(source);
  const preparer = new PrepareNodiaAiFinanceMovementUseCase(ledger);
  const context: ProposalPreparerContext = {
    manager,
    conversationId: '11111111-1111-4111-8111-111111111112',
    actor: {
      actorId: '1',
      sessionId: '11111111-1111-4111-8111-111111111111',
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/finances-personal'],
  };
  return {
    preparer,
    ledger,
    source,
    context,
    category,
    obligation,
    initial,
    findOne,
    find,
    save,
    query,
    setSuperAdmin: (value: boolean) => {
      superAdmin = value;
    },
    setAuthenticated: (value: boolean) => {
      authenticated = value;
    },
    setOwnerExists: (value: boolean) => {
      ownerExists = value;
    },
    setPaid: (value: string) => {
      paid = value;
    },
  };
}
async function ready(
  f: ReturnType<typeof fixture>,
  input: NodiaAiJsonObject = command,
) {
  const result = await f.preparer.prepare(input, f.context);
  if (result.status !== 'ready') throw new Error('Expected ready proposal');
  return result;
}
function stored(
  f: ReturnType<typeof fixture>,
  result: Awaited<ReturnType<typeof ready>>,
): StoredProposalStep {
  return {
    ...result,
    id: '11111111-1111-4111-8111-111111111113',
    position: 1,
    toolName: f.preparer.toolName,
    contractHash: f.preparer.contractHash,
    outputBindings: [],
  };
}

describe('PrepareNodiaAiFinanceMovementUseCase (internal, no effect)', () => {
  it('authorizes only the sealed historical owner without decoding or preparing its old command', async () => {
    const f = fixture();
    const step = stored(f, await ready(f));
    Object.assign(step, { contractHash: 'b'.repeat(64) });
    step.commandTemplate.command = {
      retired_contract_field: 'not a current DTO',
    };
    const original = JSON.stringify(step);
    const prepare = vi.spyOn(f.preparer, 'prepare');
    await expect(
      f.preparer.verifyHistoricalReadAuthority(step, f.context),
    ).resolves.toBeUndefined();
    expect(prepare).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
    expect(JSON.stringify(step)).toBe(original);
    await expect(f.preparer.verifyAuthority(step, f.context)).rejects.toThrow();
    f.setAuthenticated(false);
    await expect(
      f.preparer.verifyHistoricalReadAuthority(step, f.context),
    ).rejects.toThrow();
  });
  it.each(['owner', 'scope', 'module', 'binding'])(
    'rejects a historical finance read with invalid %s authority',
    async (variant) => {
      const f = fixture();
      const step = stored(f, await ready(f));
      if (variant === 'owner') {
        step.scope.subject_user_id = '2';
        step.commandTemplate.owner_id = '2';
      }
      if (variant === 'scope') step.scope.unrecognized = '1';
      if (variant === 'module') Object.assign(f.context, { moduleRoutes: [] });
      if (variant === 'binding') Object.assign(step, { outputBindings: [{}] });
      await expect(
        f.preparer.verifyHistoricalReadAuthority(step, f.context),
      ).rejects.toThrow();
      expect(f.save).not.toHaveBeenCalled();
    },
  );
  it.each(['name', 'key'] as const)(
    'rejects category %s changes even when the timestamp is identical',
    async (field) => {
      const f = fixture();
      const step = stored(f, await ready(f));
      const snapshot = JSON.stringify(step);
      const timestamp = f.category.updated_at;
      f.category[field] = 'changed';
      await expect(
        f.preparer.resolveConfirmedCommand(step, f.context),
      ).rejects.toThrow('nodia_ai:preconditions_changed');
      expect(f.category.updated_at).toBe(timestamp);
      expect(JSON.stringify(step)).toBe(snapshot);
      expect(f.save).not.toHaveBeenCalled();
    },
  );
  it('resolves the reviewed native DTO exactly without preparing, defaults or a new transaction', async () => {
    const f = fixture();
    const step = stored(f, await ready(f));
    const snapshot = JSON.stringify(step);
    const prepare = vi.spyOn(f.preparer, 'prepare');
    const resolved = await f.preparer.resolveConfirmedCommand(step, f.context);
    expect(resolved).toEqual({
      ownerId: '1',
      dto: {
        name: 'Comida',
        amount: '20000',
        type: 'expense',
        status: 'paid',
        category_id: '7',
        obligation_id: null,
        is_active: true,
      },
    });
    expect(JSON.stringify(step)).toBe(snapshot);
    expect(prepare).not.toHaveBeenCalled();
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });
  it.each(['is_active', 'obligation_id', 'status'])(
    'rejects an incomplete frozen command instead of supplying %s',
    async (field) => {
      const f = fixture();
      const step = stored(f, await ready(f));
      delete (step.commandTemplate.command as NodiaAiJsonObject)[field];
      await expect(
        f.preparer.resolveConfirmedCommand(step, f.context),
      ).rejects.toThrow('nodia_ai:invalid_input');
      expect(f.save).not.toHaveBeenCalled();
    },
  );
  it.each(['name', 'extra_field', 'origins', 'schema_version'])(
    'rejects nonnormalized or malformed frozen %s',
    async (field) => {
      const f = fixture();
      const step = stored(f, await ready(f));
      const values = step.commandTemplate.command as NodiaAiJsonObject;
      if (field === 'name') values.name = '  Comida  ';
      if (field === 'extra_field') values.extra_field = 'unreviewed';
      if (field === 'origins')
        delete (step.commandTemplate.origins as NodiaAiJsonObject).amount;
      if (field === 'schema_version')
        delete step.commandTemplate.schema_version;
      await expect(
        f.preparer.resolveConfirmedCommand(step, f.context),
      ).rejects.toThrow('nodia_ai:invalid_input');
      expect(f.save).not.toHaveBeenCalled();
    },
  );
  it('rejects undeclared scope and unresolved bindings at the native effect boundary', async () => {
    const f = fixture();
    const step = stored(f, await ready(f));
    await expect(
      f.preparer.resolveConfirmedCommand(
        { ...step, scope: { ...step.scope, extra: '2' } },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      f.preparer.resolveConfirmedCommand(
        { ...step, outputBindings: [{ key: 'unresolved' }] },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.save).not.toHaveBeenCalled();
  });
  it('rechecks material preconditions without changing the reviewed snapshot or writing a movement', async () => {
    const f = fixture();
    const result = await ready(f, { ...command, obligation_id: '8' });
    const snapshot = JSON.stringify(result);
    await f.preparer.verifyPreconditions(stored(f, result), f.context);
    expect(JSON.stringify(result)).toBe(snapshot);
    expect(f.save).not.toHaveBeenCalled();
    f.setPaid('20000');
    await expect(
      f.preparer.verifyPreconditions(stored(f, result), f.context),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
    expect(JSON.stringify(result)).toBe(snapshot);
  });
  it.each(['timestamp', 'inactive', 'missing'] as const)(
    'requires new review after category %s changes',
    async (change) => {
      const f = fixture();
      const result = await ready(f);
      if (change === 'timestamp')
        f.category.updated_at = new Date('2026-10-17T12:00:00Z');
      if (change === 'inactive') f.category.is_active = false;
      if (change === 'missing') f.category.user_id = '2';
      await expect(
        f.preparer.verifyPreconditions(stored(f, result), f.context),
      ).rejects.toThrow('nodia_ai:preconditions_changed');
      expect(f.save).not.toHaveBeenCalled();
    },
  );
  it('does not conceal lost authority or database failures as a changed business precondition', async () => {
    const f = fixture();
    const result = await ready(f);
    f.setAuthenticated(false);
    await expect(
      f.preparer.verifyPreconditions(stored(f, result), f.context),
    ).rejects.toThrow('auth:session_expired');
    f.setAuthenticated(true);
    f.findOne.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(
      f.preparer.verifyPreconditions(stored(f, result), f.context),
    ).rejects.toThrow('database unavailable');
  });
  it('asks every native mandatory field and never queries domain data for an incomplete draft', async () => {
    const f = fixture();
    const result = await f.preparer.prepare({}, f.context);
    expect(result).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['name', 'amount', 'type', 'status', 'category_id'],
    });
    expect(f.findOne).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });
  it('asks status without inferring paid from an expense', async () => {
    const f = fixture();
    const result = await f.preparer.prepare(
      {
        name: 'Voy a comprar',
        type: 'expense',
        amount: '20000',
        category_id: '7',
      },
      f.context,
    );
    expect(result).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['status'],
    });
  });
  it('normalizes with the native DTO and presents only real defaults without writes', async () => {
    const f = fixture();
    const result = await ready(f);
    expect(result.commandTemplate).toMatchObject({
      owner_id: '1',
      command: {
        ...command,
        name: 'Comida',
        obligation_id: null,
        is_active: true,
      },
      origins: {
        obligation_id: 'contract_default',
        is_active: 'contract_default',
      },
    });
    expect(result.scope).toEqual({ subject_user_id: '1' });
    expect(result.publicStep).toMatchObject({
      target: null,
      kind: 'domain_change',
      output_bindings: [],
    });
    expect(result.publicStep.changes).toEqual(
      expect.arrayContaining([
        {
          field_key: 'obligation_id',
          before: null,
          before_present: false,
          after: null,
          after_present: true,
          origin: 'contract_default',
        },
      ]),
    );
    expect(f.source.transaction).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });
  it('continues a partial draft with only the missing status and retains normalized native fields and provenance', async () => {
    const f = fixture();
    const previous = await f.preparer.prepare(
      {
        name: '  Compra comida  ',
        amount: '20000',
        type: 'expense',
        category_id: '7',
      },
      f.context,
    );
    if (previous.status !== 'needs_clarification')
      throw Error('Expected clarification');
    const snapshot = JSON.stringify(previous.partial);
    const resumed = await f.preparer.prepare(
      { status: 'paid' },
      f.context,
      previous.partial,
    );
    expect(resumed.status).toBe('ready');
    if (resumed.status !== 'ready') throw Error('Expected complete proposal');
    expect(resumed.commandTemplate).toMatchObject({
      owner_id: '1',
      command: {
        name: 'Compra comida',
        amount: '20000',
        type: 'expense',
        category_id: '7',
        status: 'paid',
        is_active: true,
        obligation_id: null,
      },
      origins: {
        name: 'user',
        amount: 'user',
        category_id: 'user',
        status: 'user',
        is_active: 'contract_default',
        obligation_id: 'contract_default',
      },
    });
    expect(JSON.stringify(previous.partial)).toBe(snapshot);
    expect(f.save).not.toHaveBeenCalled();
  });
  it('retains an explicit foreign recipient when a super_admin answers a clarification without repeating the owner', async () => {
    const f = fixture();
    f.setSuperAdmin(true);
    f.category.user_id = '2';
    const previous = await f.preparer.prepare(
      {
        owner_id: '2',
        name: 'Compra',
        amount: '20000',
        type: 'expense',
        category_id: '7',
      },
      f.context,
    );
    if (previous.status !== 'needs_clarification')
      throw Error('Expected clarification');
    const resumed = await f.preparer.prepare(
      { status: 'paid' },
      f.context,
      previous.partial,
    );
    expect(resumed).toMatchObject({
      status: 'ready',
      scope: { subject_user_id: '2' },
      commandTemplate: { owner_id: '2' },
    });
    expect(f.context.actor.actorId).toBe('1');
  });
  it('rejects changing the recipient through a draft continuation', async () => {
    const f = fixture();
    f.setSuperAdmin(true);
    const previous = await f.preparer.prepare(
      { name: 'Compra', amount: '20000', type: 'expense', category_id: '7' },
      f.context,
    );
    if (previous.status !== 'needs_clarification')
      throw Error('Expected clarification');
    await expect(
      f.preparer.prepare(
        { status: 'paid', owner_id: '2' },
        f.context,
        previous.partial,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      f.preparer.prepare(
        {
          ...previous.partial,
          owner_id: '2',
          command: {
            ...(previous.partial.command as NodiaAiJsonObject),
            status: 'paid',
          },
        },
        f.context,
        previous.partial,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('does not infer status while continuing a draft with an unrelated correction', async () => {
    const f = fixture();
    const previous = await f.preparer.prepare(
      { name: 'Compra', amount: '20000', type: 'expense', category_id: '7' },
      f.context,
    );
    if (previous.status !== 'needs_clarification')
      throw Error('Expected clarification');
    const resumed = await f.preparer.prepare(
      { name: 'Cena' },
      f.context,
      previous.partial,
    );
    expect(resumed).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['status'],
      partial: { command: { name: 'Cena', amount: '20000', category_id: '7' } },
    });
    if (resumed.status !== 'needs_clarification')
      throw Error('Expected clarification');
    expect(Object.hasOwn(resumed.partial.command as object, 'status')).toBe(
      false,
    );
  });
  it('preserves real default provenance when applying a registered delta over an internal template', async () => {
    const f = fixture();
    const previous = await ready(f);
    const resumed = await f.preparer.prepare(
      { name: 'Cena' },
      f.context,
      previous.commandTemplate,
    );
    expect(resumed).toMatchObject({
      status: 'ready',
      commandTemplate: {
        origins: {
          is_active: 'contract_default',
          obligation_id: 'contract_default',
          name: 'user',
        },
      },
    });
  });
  it.each([
    0,
    '0',
    '01',
    20000,
    null,
    '-1',
    '9223372036854775808',
    '1.5',
    '1e3',
  ])('rejects invalid amount %j without coercion', async (amount) => {
    const f = fixture();
    await expect(
      f.preparer.prepare({ ...command, amount }, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.findOne).not.toHaveBeenCalled();
  });
  it('retains PostgreSQL maximum amount as a decimal string', async () => {
    const f = fixture();
    const result = await ready(f, {
      ...command,
      amount: '9223372036854775807',
    });
    expect((result.commandTemplate.command as NodiaAiJsonObject).amount).toBe(
      '9223372036854775807',
    );
  });
  it.each([
    { name: '   ' },
    { name: null },
    { name: 'x'.repeat(256) },
    { category_id: 7 },
    { is_active: null },
    { status: null },
    { sql: 'SELECT *' },
    { owner_id: null },
  ])('rejects malformed native inputs and unknown fields %j', async (patch) => {
    const f = fixture();
    await expect(
      f.preparer.prepare({ ...command, ...patch }, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('preserves explicit false and nullable obligation with user provenance', async () => {
    const f = fixture();
    const result = await ready(f, {
      ...command,
      is_active: false,
      obligation_id: null,
    });
    expect(result.publicStep.changes).toEqual(
      expect.arrayContaining([
        {
          field_key: 'is_active',
          before: null,
          before_present: false,
          after: false,
          after_present: true,
          origin: 'user',
        },
      ]),
    );
    expect(
      (result.commandTemplate.origins as NodiaAiJsonObject).obligation_id,
    ).toBe('user');
  });
  it.each([
    { type: 'income', status: 'paid' },
    { type: 'expense', status: 'received' },
  ])('uses the native type/status compatibility rule %j', async (patch) => {
    const f = fixture();
    await expect(ready(f, { ...command, ...patch })).rejects.toThrow(
      'finance:invalid_movement_state',
    );
  });
  it('requires an active category in the exact recipient scope', async () => {
    const f = fixture();
    f.category.is_active = false;
    await expect(ready(f)).rejects.toThrow('finance:inactive_category');
    f.category.is_active = true;
    f.category.user_id = '2';
    await expect(ready(f)).rejects.toThrow('finance:not_found');
  });
  it('uses native session/role authority rather than trusting an old super_admin snapshot', async () => {
    const f = fixture();
    f.context.actor.isSuperAdmin = true;
    await expect(ready(f, { ...command, owner_id: '2' })).rejects.toThrow(
      'finance:scope_denied',
    );
    f.setAuthenticated(false);
    await expect(ready(f)).rejects.toThrow('auth:session_expired');
  });
  it('allows a real super_admin with an explicit existing recipient and preserves actor', async () => {
    const f = fixture();
    f.setSuperAdmin(true);
    f.category.user_id = '2';
    const result = await ready(f, { ...command, owner_id: '2' });
    expect(result.scope).toEqual({ subject_user_id: '2' });
    expect(
      f.query.mock.calls.find(([sql]) => sql.startsWith('SELECT u.id')),
    ).toBeDefined();
    expect(f.context.actor.actorId).toBe('1');
    f.setOwnerExists(false);
    await expect(ready(f, { ...command, owner_id: '2' })).rejects.toThrow(
      'finance:owner_not_found',
    );
  });
  it('captures real obligation/precondition observations and enforces repayment capacity', async () => {
    const f = fixture();
    const result = await ready(f, { ...command, obligation_id: '8' });
    expect(result.preconditions).toMatchObject({
      obligation: {
        id: '8',
        user_id: '1',
        amount: '50000',
        confirmed_paid: '10000',
        initial_movement_id: '9',
      },
    });
    f.setPaid('40000');
    await expect(ready(f, { ...command, obligation_id: '8' })).rejects.toThrow(
      'finance:overpayment',
    );
  });
  it('retains native inactive, cancelled-initial, and repayment-direction rejection', async () => {
    const f = fixture();
    f.obligation.is_active = false;
    await expect(ready(f, { ...command, obligation_id: '8' })).rejects.toThrow(
      'finance:inactive_obligation',
    );
    f.obligation.is_active = true;
    f.initial.status = 'cancelled';
    await expect(ready(f, { ...command, obligation_id: '8' })).rejects.toThrow(
      'finance:cancelled_obligation',
    );
    f.initial.status = 'received';
    f.obligation.type = 'loan';
    await expect(ready(f, { ...command, obligation_id: '8' })).rejects.toThrow(
      'finance:invalid_repayment_direction',
    );
  });
  it('edits registered fields, revalidates, and preserves untouched default provenance', async () => {
    const f = fixture();
    const first = await ready(f);
    const partial = await f.preparer.applyEdits(
      first.commandTemplate,
      [{ step_id: 'unused-by-domain', field_key: 'name', value: ' Cena ' }],
      f.context,
    );
    const second = await ready(f, partial);
    expect(second.commandTemplate).toMatchObject({
      command: { name: 'Cena' },
      origins: {
        obligation_id: 'contract_default',
        is_active: 'contract_default',
        name: 'user',
      },
    });
    expect((first.commandTemplate.command as NodiaAiJsonObject).name).toBe(
      'Comida',
    );
  });
  it('an explicit edit of the same default value records user provenance', async () => {
    const f = fixture();
    const first = await ready(f);
    const partial = await f.preparer.applyEdits(
      first.commandTemplate,
      [{ step_id: 's', field_key: 'is_active', value: true }],
      f.context,
    );
    const second = await ready(f, partial);
    expect(
      (second.commandTemplate.origins as NodiaAiJsonObject).is_active,
    ).toBe('user');
    expect(
      (second.commandTemplate.origins as NodiaAiJsonObject).obligation_id,
    ).toBe('contract_default');
  });
  it.each(['owner_id', 'command.name', '/name', '__proto__', 'constructor'])(
    'rejects managed/unknown/executable field key %s',
    async (field_key) => {
      const f = fixture();
      const first = await ready(f);
      await expect(
        f.preparer.applyEdits(
          first.commandTemplate,
          [{ step_id: 's', field_key, value: 'bad' }],
          f.context,
        ),
      ).rejects.toThrow('nodia_ai:invalid_input');
    },
  );
  it('rejects duplicate semantic edits and structured values for scalar native fields', async () => {
    const f = fixture();
    const first = await ready(f);
    await expect(
      f.preparer.applyEdits(
        first.commandTemplate,
        [
          { step_id: 's', field_key: 'amount', value: '3' },
          { step_id: 's', field_key: 'amount', value: '4' },
        ],
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      f.preparer.applyEdits(
        first.commandTemplate,
        [
          {
            step_id: 's',
            field_key: 'name',
            value: { kind: 'object', fields: [] },
          },
        ],
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('revalidates stored-result authority without refreshing business observations', async () => {
    const f = fixture();
    const result = await ready(f, { ...command, obligation_id: '8' });
    f.findOne.mockClear();
    f.find.mockClear();
    f.category.is_active = false;
    f.initial.status = 'cancelled';
    const before = JSON.stringify(result);
    await f.preparer.verifyAuthority(stored(f, result), f.context);
    expect(f.findOne).not.toHaveBeenCalled();
    expect(f.find).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toBe(before);
    f.setAuthenticated(false);
    await expect(
      f.preparer.verifyAuthority(stored(f, result), f.context),
    ).rejects.toThrow('auth:session_expired');
  });
  it('requires active shared transaction and target module before native reads', async () => {
    const f = fixture();
    await expect(
      f.preparer.prepare(command, { ...f.context, moduleRoutes: [] }),
    ).rejects.toThrow('nodia_ai:capability_denied');
    f.context.manager.queryRunner!.isTransactionActive = false;
    await expect(ready(f)).rejects.toThrow(
      'authorization:transaction_required',
    );
  });
  it('rejects corrupted stored scope, contract, and forged provenance', async () => {
    const f = fixture();
    const result = await ready(f);
    await expect(
      f.preparer.verifyAuthority(
        { ...stored(f, result), scope: { subject_user_id: '2' } },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:capability_denied');
    await expect(
      f.preparer.verifyAuthority(
        { ...stored(f, result), contractHash: '0'.repeat(64) },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:capability_denied');
    await expect(
      ready(f, {
        ...result.commandTemplate,
        origins: { amount: 'contract_default' },
      }),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
});
