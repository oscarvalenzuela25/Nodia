import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import { FinanceMovementService } from '../../finance-movement/finance-movement.service.js';
import { CreateFinanceMovementUseCase } from '../../finance-movement/use-case/create-finance-movement.use-case.js';
import { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';
import { FinanceMovement } from '../../finance-movement/entities/finance-movement.entity.js';
import { PrepareNodiaAiFinanceMovementUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { ExecuteNodiaAiFinanceMovementEffectUseCase } from './execute-nodia-ai-finance-movement-effect.use-case.js';

const input = {
  name: 'Comida',
  amount: '9007199254740993',
  type: 'expense',
  status: 'paid',
  category_id: '7',
  is_active: false,
};
function fixture() {
  let authenticated = true;
  let superAdmin = false;
  const category = Object.assign(new FinanceCategory(), {
    id: '7',
    user_id: '1',
    name: 'Comida',
    key: 'food',
    is_active: true,
    updated_at: new Date('2026-10-17T12:00:00Z'),
  });
  const saved: Partial<FinanceMovement>[] = [];
  const save = vi.fn(async (movement: Partial<FinanceMovement>) => {
    const row = { ...movement, id: '31', category, obligation: null };
    saved.push(row);
    return row;
  });
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
    if (sql.startsWith('SELECT EXISTS')) return [{ exists: true }];
    return [];
  });
  const repository = {
    create: (value: Partial<FinanceMovement>) => value,
    save,
    findOne: vi.fn(
      async ({ where }: { where: { id: string; user_id: string } }) =>
        where.id === category.id && where.user_id === category.user_id
          ? category
          : null,
    ),
  };
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
    getRepository: vi.fn(() => repository),
  } as unknown as EntityManager;
  const source = {
    transaction: vi.fn(() => {
      throw Error('No independent transaction');
    }),
  } as unknown as DataSource;
  const ledger = new FinanceLedgerService(source);
  const movements = {
    findOne: vi.fn(
      async (_ownerId: string, _id: string, transaction: EntityManager) => {
        if (transaction !== manager) throw Error('Wrong manager');
        return saved.at(-1);
      },
    ),
  } as unknown as FinanceMovementService;
  const preparer = new PrepareNodiaAiFinanceMovementUseCase(ledger);
  const create = new CreateFinanceMovementUseCase(ledger, movements);
  const effect = new ExecuteNodiaAiFinanceMovementEffectUseCase(
    preparer,
    create,
  );
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
    statementTimeoutMs: 2000,
  };
  return {
    effect,
    preparer,
    create,
    context,
    source,
    manager,
    category,
    save,
    saved,
    setAuthenticated: (value: boolean) => {
      authenticated = value;
    },
    setSuperAdmin: (value: boolean) => {
      superAdmin = value;
    },
  };
}
async function ready(
  f: ReturnType<typeof fixture>,
  partial: NodiaAiJsonObject = input,
): Promise<StoredProposalStep> {
  const proposal = await f.preparer.prepare(partial, f.context);
  if (proposal.status !== 'ready') throw Error('Expected ready');
  return {
    ...proposal,
    id: '11111111-1111-4111-8111-111111111113',
    position: 1,
    toolName: f.preparer.toolName,
    contractHash: f.preparer.contractHash,
    outputBindings: [],
  };
}

describe('ExecuteNodiaAiFinanceMovementEffectUseCase (native domain rules, mocked persistence)', () => {
  it('creates the exact expense with decimal precision and the supplied transaction', async () => {
    const f = fixture();
    const step = await ready(f);
    expect(await f.effect.execute(step, f.context)).toEqual({
      id: '31',
      ownerId: '1',
    });
    expect(f.saved).toEqual([
      expect.objectContaining({ ...input, user_id: '1', obligation_id: null }),
    ]);
    expect(f.save).toHaveBeenCalledOnce();
    expect(f.source.transaction).not.toHaveBeenCalled();
  });
  it('preserves the real actor when a current super_admin creates for another owner', async () => {
    const f = fixture();
    f.setSuperAdmin(true);
    f.category.user_id = '2';
    const step = await ready(f, { ...input, owner_id: '2' });
    const create = vi.spyOn(f.create, 'execute');
    expect(await f.effect.execute(step, f.context)).toEqual({
      id: '31',
      ownerId: '2',
    });
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      userId: '1',
      ownerId: '2',
      transaction: f.manager,
    });
    expect(f.saved[0]?.user_id).toBe('2');
  });
  it.each([
    'session',
    'scope',
    'contract',
    'transaction',
    'precondition',
    'dto',
    'module',
  ])('rejects invalid %s without a native write', async (change) => {
    const f = fixture();
    let step = await ready(f);
    let context = f.context;
    if (change === 'session') f.setAuthenticated(false);
    if (change === 'scope') step = { ...step, scope: { subject_user_id: '2' } };
    if (change === 'contract') step = { ...step, contractHash: '0'.repeat(64) };
    if (change === 'transaction')
      context = {
        ...context,
        manager: {
          ...f.manager,
          queryRunner: { isTransactionActive: false },
        } as EntityManager,
      };
    if (change === 'precondition') f.category.is_active = false;
    if (change === 'dto')
      (step.commandTemplate.command as NodiaAiJsonObject).amount = '0';
    if (change === 'module') context = { ...context, moduleRoutes: [] };
    await expect(f.effect.execute(step, context)).rejects.toThrow();
    expect(f.save).not.toHaveBeenCalled();
    expect(f.source.transaction).not.toHaveBeenCalled();
  });
  it('does not treat the cached super_admin flag as authority after revocation', async () => {
    const f = fixture();
    f.setSuperAdmin(true);
    f.category.user_id = '2';
    const step = await ready(f, { ...input, owner_id: '2' });
    f.setSuperAdmin(false);
    f.context.actor.isSuperAdmin = true;
    await expect(f.effect.execute(step, f.context)).rejects.toThrow(
      'finance:scope_denied',
    );
    expect(f.save).not.toHaveBeenCalled();
  });
  it('propagates a native write failure to the caller transaction', async () => {
    const f = fixture();
    const step = await ready(f);
    f.save.mockRejectedValueOnce(Error('synthetic persistence failure'));
    await expect(f.effect.execute(step, f.context)).rejects.toThrow(
      'synthetic persistence failure',
    );
    expect(f.source.transaction).not.toHaveBeenCalled();
  });
});
