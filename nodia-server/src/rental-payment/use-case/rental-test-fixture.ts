import { DataSource, type EntityManager } from 'typeorm';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import { RentalClock } from '../../rental-common/rental-clock.js';
import { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import { RentalReservation } from '../../rental-reservation/entities/rental-reservation.entity.js';
import { RentalPayment } from '../entities/rental-payment.entity.js';
import { RentalCollaborator } from '../../rental-collaborator/entities/rental-collaborator.entity.js';
import { RentalCancellationPolicy } from '../../rental-cancellation-policy/entities/rental-cancellation-policy.entity.js';
import { RentalCancellationRule } from '../../rental-cancellation-policy/entities/rental-cancellation-policy-rule.entity.js';
import { User } from '../../user/entities/user.entity.js';

type Row = Record<string, unknown>;
type EntityClass<T extends object> = new () => T;

/** Fake I/O only: real transaction/access/idempotency and resource business rules still execute. */
export function rentalTestFixture() {
  const tables = new Map<Function, Row[]>();
  const table = (type: Function) => {
    if (!tables.has(type)) tables.set(type, []);
    return tables.get(type)!;
  };
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  let failSave: Function | null = null;
  const queryRows = new Map<Function, Row[]>();
  const queryExists = new Map<Function, boolean>();
  function queryBuilder(type: Function) {
    const builder = {
      select: () => builder,
      addSelect: () => builder,
      where: () => builder,
      andWhere: () => builder,
      orderBy: () => builder,
      addOrderBy: () => builder,
      take: () => builder,
      innerJoin: () => builder,
      setParameter: () => builder,
      async getMany() {
        return structuredClone(queryRows.get(type) ?? []);
      },
      async getOne() {
        return null;
      },
      async getExists() {
        return queryExists.get(type) ?? false;
      },
    };
    return builder;
  }
  const repository = (type: Function) => ({
    createQueryBuilder: () => queryBuilder(type),
    async findOne(options: { where: Row }) {
      return structuredClone(
        table(type).find((row) => matches(row, options.where)) ?? null,
      );
    },
    async findOneBy(where: Row) {
      return structuredClone(
        table(type).find((row) => matches(row, where)) ?? null,
      );
    },
    async existsBy(where: Row) {
      return table(type).some((row) => matches(row, where));
    },
    async find(options: { where?: Row; take?: number }) {
      return structuredClone(
        table(type)
          .filter((row) => matches(row, options.where ?? {}))
          .slice(0, options.take),
      );
    },
    async save(input: Row | Row[]): Promise<Row | Row[]> {
      if (Array.isArray(input)) {
        const results: Row[] = [];
        for (const entry of input)
          results.push((await repository(type).save(entry)) as Row);
        return results;
      }
      if (failSave === type) throw new Error('Synthetic save failure');
      const rows = table(type);
      const existing = rows.find((row) => row.id === input.id);
      const id =
        input.id ??
        (
          rows.reduce(
            (max, row) =>
              BigInt(String(row.id)) > max ? BigInt(String(row.id)) : max,
            0n,
          ) + 1n
        ).toString();
      const result = {
        created_at: new Date(),
        updated_at: new Date(),
        ...existing,
        ...structuredClone(input),
        id,
      };
      if (existing) Object.assign(existing, result);
      else rows.push(result);
      return structuredClone(result);
    },
  });
  const manager = {
    getRepository: repository,
    async query(sql: string, params: string[] = []) {
      if (sql.startsWith('SET LOCAL')) return [];
      if (sql.includes('SUM(amount)') && sql.includes('FROM rental_payments')) {
        const rows = table(RentalPayment).filter(
          (row) =>
            row.property_id === params[0] &&
            row.reservation_id === params[1] &&
            row.status === 'confirmed',
        );
        return [
          {
            received: rows
              .filter((row) => row.type === 'payment')
              .reduce((sum, row) => sum + BigInt(String(row.amount)), 0n)
              .toString(),
            refunded: rows
              .filter((row) => row.type === 'refund')
              .reduce((sum, row) => sum + BigInt(String(row.amount)), 0n)
              .toString(),
          },
        ];
      }
      throw new Error('Unexpected synthetic SQL');
    },
  } as unknown as EntityManager;
  const source = {
    createQueryRunner() {
      let backup: Map<Function, Row[]>;
      return {
        manager,
        query: manager.query.bind(manager),
        isTransactionActive: false,
        async connect() {},
        async release() {},
        async startTransaction() {
          this.isTransactionActive = true;
          backup = new Map(
            [...tables.entries()].map(([type, rows]) => [
              type,
              structuredClone(rows),
            ]),
          );
        },
        async commitTransaction() {
          this.isTransactionActive = false;
        },
        async rollbackTransaction() {
          tables.clear();
          for (const [type, rows] of backup) tables.set(type, rows);
          this.isTransactionActive = false;
        },
      };
    },
  } as unknown as DataSource;
  function seed<T extends object>(type: EntityClass<T>, input: Partial<T>): T {
    const row = Object.assign(new type(), input);
    table(type).push(row as Row);
    return row;
  }
  seed(User, { id: '1', is_active: true });
  seed(User, { id: '2', is_active: true });
  seed(User, { id: '3', is_active: true });
  seed(RentalProperty, {
    id: '10',
    owner_id: '1',
    timezone: 'America/Santiago',
    is_active: true,
    max_guests: 6,
    minimum_turnover_minutes: 0,
  });
  seed(RentalCollaborator, {
    id: '1',
    property_id: '10',
    user_id: '2',
    is_active: true,
  });
  seed(RentalCancellationPolicy, {
    id: '30',
    property_id: '10',
    name: 'Synthetic',
    is_active: true,
  });
  seed(RentalCancellationRule, {
    id: '31',
    policy_id: '30',
    min_days_before: 0,
    refund_percent: '50.00',
  });
  seed(RentalReservation, {
    id: '40',
    property_id: '10',
    channel: 'whatsapp',
    status: 'draft',
    total_amount: '200000',
    commission_amount: '0',
    deposit_amount: '40000',
    policy_snapshot: null,
    cancellation_policy_id: '30',
    refund_amount: null,
    cancelled_at: null,
    created_at: new Date('2026-10-01T12:00:00Z'),
    updated_at: new Date('2026-10-01T12:00:00Z'),
  });
  return {
    tx: new RentalTransactionService(source, new RentalClock()),
    source,
    manager,
    seed,
    table,
    queryRows: (type: Function, rows: object[]) => {
      queryRows.set(type, rows as Row[]);
    },
    queryExists: (type: Function, result: boolean) => {
      queryExists.set(type, result);
    },
    failOn: (type: Function | null) => {
      failSave = type;
    },
  };
}

export const rentalKey = '11111111-1111-4111-8111-111111111111';
export const secondRentalKey = '22222222-2222-4222-8222-222222222222';
