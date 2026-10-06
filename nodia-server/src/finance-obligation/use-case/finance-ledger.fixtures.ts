import { vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';
import type { FinanceMovement } from '../../finance-movement/entities/finance-movement.entity.js';
import type { FinanceObligation } from '../entities/finance-obligation.entity.js';
import type { FinanceLedgerService } from '../finance-ledger.service.js';
import type { FinanceMovementService } from '../../finance-movement/finance-movement.service.js';

export function ledgerFixture() {
  const manager = { fixture: true } as unknown as EntityManager;
  const category = {
    id: '2',
    user_id: '1',
    name: 'Personal',
    key: 'personal',
    is_active: true,
  } as FinanceCategory;
  const obligation: FinanceObligation = {
    id: '3',
    user_id: '1',
    name: 'Loan',
    key: 'loan',
    type: 'loan',
    amount: '100000',
    description: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    user: undefined!,
  };
  const origin: FinanceMovement = {
    id: '4',
    user_id: '1',
    category_id: '2',
    obligation_id: '3',
    name: 'Loan',
    amount: '100000',
    type: 'expense',
    status: 'paid',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    category,
    obligation,
    user: undefined!,
  };
  const payment: FinanceMovement = {
    ...origin,
    id: '5',
    name: 'Payment',
    amount: '20000',
    type: 'income',
    status: 'received',
  };
  const records = new Map<string, FinanceMovement>([
    ['4', origin],
    ['5', payment],
  ]);
  let nextId = 6;
  const calls: string[] = [];
  const ledger = {
    transaction: vi.fn(async <T>(work: (tx: EntityManager) => Promise<T>) =>
      work(manager),
    ),
    category: vi.fn(async (_tx: EntityManager, userId: string, id: string) =>
      userId === category.user_id && id === category.id ? category : null,
    ),
    obligation: vi.fn(
      async (_tx: EntityManager, userId: string, id: string) => {
        calls.push('obligation');
        return userId === obligation.user_id && id === obligation.id
          ? obligation
          : null;
      },
    ),
    movement: vi.fn(
      async (_tx: EntityManager, userId: string, id: string, lock = true) => {
        calls.push(lock ? 'movement-lock' : 'movement-read');
        const row = records.get(id);
        return row?.user_id === userId ? row : null;
      },
    ),
    initialMovements: vi.fn(async () => [records.get('4')!]),
    confirmedPaid: vi.fn(
      async (
        _tx: EntityManager,
        current: FinanceObligation,
        excludingId?: string,
      ) => {
        calls.push('sum');
        const direction = current.type === 'loan' ? 'income' : 'expense';
        const status = current.type === 'loan' ? 'received' : 'paid';
        return [...records.values()]
          .filter(
            (row) =>
              row.user_id === current.user_id &&
              row.obligation_id === current.id &&
              row.type === direction &&
              row.status === status &&
              row.id !== excludingId,
          )
          .reduce((sum, row) => sum + BigInt(row.amount), 0n)
          .toString();
      },
    ),
    saveMovement: vi.fn(
      async (_tx: EntityManager, data: Partial<FinanceMovement>) => {
        const saved = {
          ...origin,
          ...data,
          id: data.id ?? String(nextId++),
          category,
          obligation: data.obligation_id === null ? null : obligation,
        };
        records.set(saved.id, saved);
        return saved;
      },
    ),
    saveObligation: vi.fn(
      async (_tx: EntityManager, data: Partial<FinanceObligation>) => ({
        ...obligation,
        ...data,
      }),
    ),
  };
  const movements = {
    findOne: vi.fn(async (userId: string, id: string) => {
      const row = records.get(id);
      return row?.user_id === userId ? row : null;
    }),
  };
  return {
    manager,
    category,
    obligation,
    origin,
    payment,
    records,
    calls,
    ledger,
    movements,
    ledgerService: ledger as unknown as FinanceLedgerService,
    movementService: movements as unknown as FinanceMovementService,
  };
}
