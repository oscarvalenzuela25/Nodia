import { type EntityManager } from 'typeorm';
import { RentalTransactionService } from '../../rental-common/rental-transaction.service.js';
import type {
  RentalContext,
  RentalMutationOptions,
  RentalEffect,
} from '../../rental-common/types/rental.types.js';
import { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import { RentalReservation } from '../entities/rental-reservation.entity.js';
import { RentalTurnover } from '../../rental-turnover/entities/rental-turnover.entity.js';
import { localInstant } from '../../rental-common/rental-time.js';

type Row = Record<string, unknown>;
export function bookingFixture() {
  const now = new Date('2026-10-05T15:00:00.000Z');
  const property = Object.assign(new RentalProperty(), {
    id: '1',
    owner_id: '1',
    timezone: 'America/Santiago',
    is_active: true,
    max_guests: 4,
    minimum_turnover_minutes: 60,
  });
  const reservation = Object.assign(new RentalReservation(), {
    id: '10',
    property_id: '1',
    guest_name: 'Huésped sintético',
    guest_contact: 'contacto de prueba',
    guests_count: 2,
    channel: 'whatsapp',
    external_reference: null,
    check_in_on: '2026-10-20',
    check_out_on: '2026-10-22',
    check_in_time: '15:00',
    check_out_time: '11:00',
    nightly_rate: '50000',
    cleaning_fee: '0',
    discount_amount: '0',
    total_amount: '100000',
    commission_amount: '0',
    deposit_amount: '20000',
    deposit_due_at: null,
    balance_due_at: null,
    cancellation_policy_id: '30',
    policy_snapshot: null,
    status: 'draft',
    cancelled_at: null,
    refund_amount: null,
    cancellation_snapshot: null,
    notes: null,
    is_active: true,
    created_by: '1',
    updated_by: '1',
    created_at: now,
    updated_at: now,
  });
  const turnover = Object.assign(new RentalTurnover(), {
    id: '20',
    property_id: '1',
    incoming_reservation_id: '10',
    previous_reservation_id: null,
    linen_ready: null,
    cleaning_status: 'pending',
    planned_ready_at: null,
    ready_at: null,
    same_day_approved_at: null,
    notes: null,
    created_by: '1',
    updated_by: '1',
    created_at: now,
    updated_at: now,
  });
  const tables = new Map<string, Row[]>([
    ['RentalReservation', [reservation as unknown as Row]],
    ['RentalTurnover', [turnover as unknown as Row]],
    ['RentalBlock', []],
    [
      'RentalCancellationPolicy',
      [
        {
          id: '30',
          property_id: '1',
          name: 'Acuerdo sintético',
          is_active: true,
        },
      ],
    ],
    [
      'RentalCancellationRule',
      [
        {
          id: '40',
          policy_id: '30',
          min_days_before: 0,
          refund_percent: '0.00',
        },
        {
          id: '41',
          policy_id: '30',
          min_days_before: 7,
          refund_percent: '33.33',
        },
        {
          id: '42',
          policy_id: '30',
          min_days_before: 14,
          refund_percent: '100.00',
        },
      ],
    ],
    ['RentalPayment', []],
  ]);
  const rows = (name: string) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name)!;
  };
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  function builder(name: string) {
    const params: Row = {};
    const clauses: string[] = [];
    let cap = 100000;
    let offset = 0;
    const ordering: { field: string; direction: string }[] = [];
    const add = (clause: string, values?: Row) => {
      clauses.push(clause);
      Object.assign(params, values);
      return qb;
    };
    const selection = () => {
      let selected = rows(name).filter((row) => {
        if (params.pid !== undefined && row.property_id !== params.pid)
          return false;
        if (params.excludeId !== undefined && row.id === params.excludeId)
          return false;
        if (
          Array.isArray(params.occupying) &&
          !params.occupying.includes(row.status)
        )
          return false;
        if (
          Array.isArray(params.ids) &&
          !params.ids.includes(row.incoming_reservation_id)
        )
          return false;
        if (
          clauses.some((c) => c.includes('b.is_active=true')) &&
          !row.is_active
        )
          return false;
        if (name === 'RentalReservation') {
          const start = localInstant(
            row.check_in_on as string,
            (row.check_in_time as string).slice(0, 5),
            property.timezone,
          ).getTime();
          const end = localInstant(
            row.check_out_on as string,
            (row.check_out_time as string).slice(0, 5),
            property.timezone,
          ).getTime();
          if (params.at instanceof Date) {
            if (
              clauses.some(
                (c) => c.includes('r.check_out_on') && c.includes('<= :at'),
              ) &&
              end > params.at.getTime()
            )
              return false;
            if (
              clauses.some(
                (c) => c.includes('r.check_in_on') && c.includes('>= :at'),
              ) &&
              start < params.at.getTime()
            )
              return false;
          }
          if (
            params.starts instanceof Date &&
            params.ends instanceof Date &&
            !(start < params.ends.getTime() && end > params.starts.getTime())
          )
            return false;
        }
        return true;
      });
      for (const sort of [...ordering].reverse())
        selected = selected.sort((a, b) => {
          let av = a[sort.field.replace(/^[rtb]\./, '')],
            bv = b[sort.field.replace(/^[rtb]\./, '')];
          if (sort.field.includes('r.check_out_on +')) {
            av = localInstant(
              a.check_out_on as string,
              (a.check_out_time as string).slice(0, 5),
              property.timezone,
            ).getTime();
            bv = localInstant(
              b.check_out_on as string,
              (b.check_out_time as string).slice(0, 5),
              property.timezone,
            ).getTime();
          }
          if (sort.field.includes('r.check_in_on +')) {
            av = localInstant(
              a.check_in_on as string,
              (a.check_in_time as string).slice(0, 5),
              property.timezone,
            ).getTime();
            bv = localInstant(
              b.check_in_on as string,
              (b.check_in_time as string).slice(0, 5),
              property.timezone,
            ).getTime();
          }
          const direction = sort.direction === 'DESC' ? -1 : 1;
          return (av! < bv! ? -1 : av! > bv! ? 1 : 0) * direction;
        });
      return selected;
    };
    const qb = {
      where: add,
      andWhere: add,
      setParameter: (key: string, value: unknown) => {
        params[key] = value;
        return qb;
      },
      select: () => qb,
      innerJoin: () => qb,
      orderBy: (field: string, direction: string) => {
        ordering.length = 0;
        ordering.push({ field, direction });
        return qb;
      },
      addOrderBy: (field: string, direction: string) => {
        ordering.push({ field, direction });
        return qb;
      },
      skip: (n: number) => {
        offset = n;
        return qb;
      },
      take: (n: number) => {
        cap = n;
        return qb;
      },
      getMany: async () =>
        structuredClone(selection().slice(offset, offset + cap)),
      getOne: async () => structuredClone(selection()[0] ?? null),
      getExists: async () => selection().length > 0,
      getManyAndCount: async () => [
        structuredClone(selection().slice(offset, offset + cap)),
        selection().length,
      ],
    };
    return qb;
  }
  const manager = {
    getRepository: (entity: { name: string }) => ({
      createQueryBuilder: () => builder(entity.name),
      findOne: async (options: { where: Row }) =>
        structuredClone(
          rows(entity.name).find((r) => matches(r, options.where)) ?? null,
        ),
      findOneBy: async (where: Row) =>
        structuredClone(
          rows(entity.name).find((r) => matches(r, where)) ?? null,
        ),
      existsBy: async (where: Row) =>
        rows(entity.name).some((r) => matches(r, where)),
      find: async (options: { where: Row }) =>
        structuredClone(
          rows(entity.name).filter((r) => matches(r, options.where)),
        ),
      save: async (input: Row) => {
        const data = {
          ...input,
          id: input.id ?? String(100 + rows(entity.name).length),
          created_at: input.created_at ?? now,
          updated_at: now,
        };
        const index = rows(entity.name).findIndex((r) => r.id === data.id);
        if (index === -1) rows(entity.name).push(data);
        else rows(entity.name)[index] = data;
        return structuredClone(data);
      },
    }),
    query: async (sql: string, values: unknown[]) => {
      const payments = rows('RentalPayment').filter(
        (p) => p.property_id === values[0] && p.reservation_id === values[1],
      );
      if (sql.includes('SELECT EXISTS'))
        return [{ exists: payments.length > 0 }];
      if (sql.includes('SUM(amount)'))
        return [
          {
            received: payments
              .filter((p) => p.status === 'confirmed' && p.type === 'payment')
              .reduce((n, p) => n + BigInt(p.amount as string), 0n)
              .toString(),
            refunded: payments
              .filter((p) => p.status === 'confirmed' && p.type === 'refund')
              .reduce((n, p) => n + BigInt(p.amount as string), 0n)
              .toString(),
          },
        ];
      if (sql.includes('SELECT id::text'))
        return payments
          .filter(
            (p) =>
              p.type === 'payment' &&
              p.status === 'confirmed' &&
              BigInt(p.id as string) > BigInt(values[2] as string),
          )
          .map((p) => ({
            id: p.id,
            amount: p.amount,
            occurred_on: p.occurred_on,
          }));
      return [];
    },
  } as unknown as EntityManager;
  const ctx: RentalContext = {
    manager,
    property,
    actorId: '1',
    owner: true,
    now,
  };
  const effects: RentalEffect[] = [];
  const transactions = {
    read: async (
      _actor: string,
      _pid: string,
      fn: (c: RentalContext) => Promise<unknown>,
    ) => fn(ctx),
    mutate: async (
      options: RentalMutationOptions,
      fn: (c: RentalContext) => Promise<RentalEffect>,
    ) => {
      const effect = await fn(ctx);
      effects.push(effect);
      return {
        operation: options.operation,
        property_id: property.id,
        resource_id: effect.resource_id,
        resource_type: effect.resource_type,
        status: effect.status,
        updated_at: effect.updated_at.toISOString(),
      };
    },
  } as unknown as RentalTransactionService;
  return {
    ctx,
    transactions,
    property,
    reservation,
    turnover,
    rows,
    effects,
    now,
  };
}
