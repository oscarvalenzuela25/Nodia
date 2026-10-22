import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { ProposalPreparerContext } from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { BuildNodiaAiRentalConfigurationOperationsUseCase } from '../../nodia-ai-rental-configuration/use-case/build-nodia-ai-rental-configuration-operations.use-case.js';
import { BuildNodiaAiRentalReservationOperationsUseCase } from '../../nodia-ai-rental-reservation/use-case/build-nodia-ai-rental-reservation-operations.use-case.js';
import { BuildNodiaAiRentalMoneyOperationsUseCase } from '../../nodia-ai-rental-money/use-case/build-nodia-ai-rental-money-operations.use-case.js';
import { BuildNodiaAiRentalOperationsUseCase } from '../../nodia-ai-rental-operations/use-case/build-nodia-ai-rental-operations.use-case.js';
import { CreateRentalPropertyDto } from '../../rental-property/dto/create-rental-property.dto.js';
import { UpdateRentalPropertyDto } from '../../rental-property/dto/update-rental-property.dto.js';
import { CreateRentalCollaboratorDto } from '../../rental-collaborator/dto/create-rental-collaborator.dto.js';
import { UpdateRentalCollaboratorDto } from '../../rental-collaborator/dto/update-rental-collaborator.dto.js';
import { CreateRentalCancellationPolicyDto } from '../../rental-cancellation-policy/dto/create-rental-cancellation-policy.dto.js';
import { UpdateRentalCancellationPolicyDto } from '../../rental-cancellation-policy/dto/update-rental-cancellation-policy.dto.js';
import { CreateRentalReservationDto } from '../../rental-reservation/dto/create-rental-reservation.dto.js';
import { UpdateRentalReservationDto } from '../../rental-reservation/dto/update-rental-reservation.dto.js';
import {
  ConfirmRentalReservationDto,
  PreviewRentalCancellationDto,
} from '../../rental-reservation/dto/reservation-commands.dto.js';
import {
  CreateRentalPaymentDto,
  VoidRentalPaymentDto,
} from '../../rental-payment/dto/rental-payment.dto.js';
import {
  CreateRentalExpenseDto,
  UpdateRentalExpenseDto,
  PayRentalExpenseDto,
  VoidRentalExpenseDto,
} from '../../rental-expense/dto/rental-expense.dto.js';
import {
  CreateRentalBlockDto,
  UpdateRentalBlockDto,
} from '../../rental-block/dto/rental-block.dto.js';
import { UpdateRentalTurnoverDto } from '../../rental-turnover/dto/update-rental-turnover.dto.js';

interface ContractBundle {
  schema: NodiaAiJsonObject;
  tools: {
    tool_name: string;
    input_definition: string;
    resource_key: string;
    description: string;
  }[];
}
const bundle = JSON.parse(
  readFileSync(
    new URL(
      '../../nodia-ai-products/contracts/write-reservations.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as ContractBundle;
const sourceJson = JSON.stringify(bundle.schema);
const sha256 = createHash('sha256').update(sourceJson).digest('hex');
const contracts = new Map(
  bundle.tools.map((tool) => [
    tool.tool_name,
    compileNodiaAiToolSchema({
      sourceJson,
      sha256,
      definition: tool.input_definition,
    }),
  ]),
);
const scope = { property_id: '10', id: '20' };
const createScope = { property_id: '10' };
const platform = {
  reference: 'Policy reference',
  description: 'Explicit platform conditions',
};
const rules = [
  { min_days_before: 0, refund_percent: '0' },
  { min_days_before: 7, refund_percent: '50.25' },
];
type Case = {
  name: string;
  input: NodiaAiJsonObject;
  dto: (new () => object) | null;
};
const cases: Case[] = [
  {
    name: 'nodia_rental_properties_prepare_create',
    input: {
      name: 'Casa',
      max_guests: 6,
      timezone: 'America/Santiago',
      owner_id: '1',
      default_nightly_rate: '9223372036854775807',
      default_deposit_percent: '100.00',
      check_in_time: null,
    },
    dto: CreateRentalPropertyDto,
  },
  {
    name: 'nodia_rental_properties_prepare_update',
    input: { ...scope, is_active: false, default_cancellation_policy_id: null },
    dto: UpdateRentalPropertyDto,
  },
  {
    name: 'nodia_rental_collaborators_prepare_create',
    input: { ...createScope, user_id: '2', position: null },
    dto: CreateRentalCollaboratorDto,
  },
  {
    name: 'nodia_rental_collaborators_prepare_update',
    input: { ...scope, is_active: false },
    dto: UpdateRentalCollaboratorDto,
  },
  {
    name: 'nodia_rental_cancellation_policies_prepare_create',
    input: { ...createScope, name: 'Flexible', rules },
    dto: CreateRentalCancellationPolicyDto,
  },
  {
    name: 'nodia_rental_cancellation_policies_prepare_update',
    input: { ...scope, rules },
    dto: UpdateRentalCancellationPolicyDto,
  },
  {
    name: 'nodia_rental_reservations_prepare_create',
    input: {
      ...createScope,
      guest_name: 'Invitado',
      guest_contact: 'Contacto',
      guests_count: 2,
      channel: 'whatsapp',
      check_in_on: '2028-02-29',
      check_out_on: '2028-03-01',
      check_in_time: '15:00',
      check_out_time: '11:00',
      nightly_rate: '9007199254740993',
      deposit_amount: '0',
      notes: null,
      deposit_due_at: '2028-02-28T12:30:00.123-03:00',
    },
    dto: CreateRentalReservationDto,
  },
  {
    name: 'nodia_rental_reservations_prepare_update',
    input: {
      ...scope,
      guest_name: 'Otro invitado',
      cancellation_policy_id: null,
      notes: null,
    },
    dto: UpdateRentalReservationDto,
  },
  {
    name: 'nodia_rental_reservations_prepare_confirm',
    input: {
      ...scope,
      same_day_approvals: ['1', '2'],
      platform_policy: platform,
    },
    dto: ConfirmRentalReservationDto,
  },
  { name: 'nodia_rental_reservations_prepare_start', input: scope, dto: null },
  {
    name: 'nodia_rental_reservations_prepare_complete',
    input: scope,
    dto: null,
  },
  {
    name: 'nodia_rental_reservations_prepare_cancel',
    input: {
      ...scope,
      cancelled_at: '2028-02-29T15:00:00Z',
      refund_amount: '0',
      resolution_note: 'Cancelación solicitada',
    },
    dto: PreviewRentalCancellationDto,
  },
  {
    name: 'nodia_rental_payments_prepare_create',
    input: {
      ...createScope,
      reservation_id: '20',
      type: 'refund',
      amount: '9223372036854775807',
      occurred_on: '2028-02-29',
      method: null,
      platform_policy: platform,
    },
    dto: CreateRentalPaymentDto,
  },
  {
    name: 'nodia_rental_payments_prepare_void',
    input: { ...scope, reason: 'Corrección' },
    dto: VoidRentalPaymentDto,
  },
  {
    name: 'nodia_rental_expenses_prepare_create',
    input: {
      ...createScope,
      name: 'Comida',
      amount: '20000',
      incurred_on: '2028-02-29',
      status: 'pending',
      paid_on: null,
      reservation_id: null,
    },
    dto: CreateRentalExpenseDto,
  },
  {
    name: 'nodia_rental_expenses_prepare_update',
    input: { ...scope, amount: '20001', category: null },
    dto: UpdateRentalExpenseDto,
  },
  {
    name: 'nodia_rental_expenses_prepare_pay',
    input: { ...scope, paid_on: '2028-02-29' },
    dto: PayRentalExpenseDto,
  },
  {
    name: 'nodia_rental_expenses_prepare_void',
    input: { ...scope, reason: 'Corrección' },
    dto: VoidRentalExpenseDto,
  },
  {
    name: 'nodia_rental_blocks_prepare_create',
    input: {
      ...createScope,
      starts_at: '2028-02-29T12:00:00Z',
      ends_at: '2028-03-01T12:00:00Z',
      reason: 'Mantención',
    },
    dto: CreateRentalBlockDto,
  },
  {
    name: 'nodia_rental_blocks_prepare_update',
    input: { ...scope, is_active: false, notes: null },
    dto: UpdateRentalBlockDto,
  },
  {
    name: 'nodia_rental_turnovers_prepare_update',
    input: {
      ...scope,
      linen_ready: false,
      cleaning_status: 'pending',
      planned_ready_at: null,
      ready_at: null,
    },
    dto: UpdateRentalTurnoverDto,
  },
  {
    name: 'nodia_rental_turnovers_prepare_approve_same_day',
    input: scope,
    dto: null,
  },
];
function validate(name: string, input: unknown) {
  const contract = contracts.get(name);
  if (!contract) throw new Error(`Missing synthetic case contract: ${name}`);
  return contract.validate(input);
}
function nativeOperations() {
  const configuration = new BuildNodiaAiRentalConfigurationOperationsUseCase(
    ...(Array.from(
      { length: 7 },
      () => ({}),
    ) as unknown as ConstructorParameters<
      typeof BuildNodiaAiRentalConfigurationOperationsUseCase
    >),
  );
  const reservation = new BuildNodiaAiRentalReservationOperationsUseCase(
    ...(Array.from(
      { length: 8 },
      () => ({}),
    ) as unknown as ConstructorParameters<
      typeof BuildNodiaAiRentalReservationOperationsUseCase
    >),
  );
  const money = new BuildNodiaAiRentalMoneyOperationsUseCase(
    ...(Array.from(
      { length: 8 },
      () => ({}),
    ) as unknown as ConstructorParameters<
      typeof BuildNodiaAiRentalMoneyOperationsUseCase
    >),
  );
  const operations = new BuildNodiaAiRentalOperationsUseCase(
    ...(Array.from(
      { length: 6 },
      () => ({}),
    ) as unknown as ConstructorParameters<
      typeof BuildNodiaAiRentalOperationsUseCase
    >),
  );
  return [
    ...configuration.operations,
    ...reservation.operations,
    ...money.operations,
    ...operations.operations,
  ];
}

describe('Reservation write contracts — AI36-C01', () => {
  it('matches all 22 real native preparers without adding tools or publishing them', () => {
    const native = nativeOperations();
    expect(cases).toHaveLength(22);
    expect(bundle.tools.map((t) => t.tool_name).sort()).toEqual(
      native.map((op) => op.toolName).sort(),
    );
    expect(cases.map((c) => c.name).sort()).toEqual(
      [...contracts.keys()].sort(),
    );
    for (const tool of bundle.tools) {
      expect(
        native.find((op) => op.toolName === tool.tool_name)?.resourceKey,
      ).toBe(tool.resource_key);
      expect(tool.description).toContain('no ejecuta cambios');
    }
  });
  it.each(cases)(
    '$name accepts partials and native DTO-compatible values without coercion or effects',
    ({ name, input, dto }) => {
      const original = structuredClone(input);
      expect(validate(name, {})).toBe(true);
      expect(validate(name, input)).toBe(true);
      expect(input).toEqual(original);
      if (dto) {
        const command = Object.fromEntries(
          Object.entries(input).filter(
            ([k]) => !['property_id', 'id'].includes(k),
          ),
        );
        expect(
          validateSync(plainToInstance(dto, command), {
            whitelist: true,
            forbidNonWhitelisted: true,
            forbidUnknownValues: true,
            skipUndefinedProperties: true,
          }),
        ).toEqual([]);
      }
    },
  );
  it.each(cases)(
    '$name rejects internal state, SQL, execution authorization and invalid IDs',
    ({ name, input }) => {
      for (const key of [
        'schema_version',
        'command',
        'origins',
        'request_key',
        'actor_id',
        'confirmed',
        'sql',
        '__proto__',
      ]) {
        const injected = JSON.parse(
          JSON.stringify({
            ...input,
            [key]: key === 'schema_version' ? 1 : 'injected',
          }),
        );
        expect(validate(name, injected), `${name}: ${key}`).toBe(false);
      }
      for (const id of [
        0,
        1,
        '0',
        '01',
        '-1',
        '9223372036854775808',
        null,
        '1 OR 1=1',
      ])
        expect(
          validate(name, { ...input, property_id: id }),
          `${name}: invalid identity`,
        ).toBe(false);
      expect(validate(name, null)).toBe(false);
      expect(validate(name, [])).toBe(false);
    },
  );
  it('routes empty partials through real preparers to clarification without touching any domain store or writer', async () => {
    const query = vi.fn(async (sql: string) =>
      sql.startsWith('SELECT u.id')
        ? [
            {
              actorId: '1',
              sessionId: '11111111-1111-4111-8111-111111111111',
              isSuperAdmin: true,
            },
          ]
        : [],
    );
    const context = {
      actor: {
        actorId: '1',
        sessionId: '11111111-1111-4111-8111-111111111111',
      },
      manager: {
        query,
        queryRunner: { isTransactionActive: true },
      } as unknown as EntityManager,
      moduleRoutes: ['/tools/reservations'],
      actionKeys: [],
      statementTimeoutMs: 1000,
    } as unknown as ProposalPreparerContext;
    for (const op of nativeOperations()) {
      const result = await op.prepare({}, context);
      expect(result.status, op.toolName).toBe('needs_clarification');
      if (result.status === 'needs_clarification')
        expect(result.missingFields.length).toBeGreaterThan(0);
    }
    expect(
      query.mock.calls.every(
        ([sql]) => !/rental_|INSERT|UPDATE|DELETE/.test(sql),
      ),
    ).toBe(true);
  });
  it('keeps absent values distinct from null, false, zero and exact bigint money', () => {
    const property = 'nodia_rental_properties_prepare_create';
    expect(
      validate(property, {
        default_nightly_rate: null,
        default_deposit_percent: '0',
        minimum_turnover_minutes: 0,
        is_active: false,
      }),
    ).toBe(true);
    expect(validate(property, { max_guests: null })).toBe(false);
    expect(
      validate('nodia_rental_properties_prepare_update', {
        check_in_time: null,
      }),
    ).toBe(false);
    for (const amount of ['0', '-1', '1.5', 20000, '01', '9223372036854775808'])
      expect(validate('nodia_rental_payments_prepare_create', { amount })).toBe(
        false,
      );
    for (const amount of ['1', '9007199254740993', '9223372036854775807'])
      expect(validate('nodia_rental_payments_prepare_create', { amount })).toBe(
        true,
      );
    expect(
      validate('nodia_rental_reservations_prepare_create', {
        deposit_amount: '0',
      }),
    ).toBe(true);
    expect(
      validate('nodia_rental_expenses_prepare_create', { status: 'voided' }),
    ).toBe(false);
    expect(
      validate('nodia_rental_expenses_prepare_update', {
        status: 'paid',
        paid_on: '2028-02-29',
      }),
    ).toBe(false);
  });
  it('rejects invalid civil dates, instants, local times and unbounded strings', () => {
    for (const check_in_on of [
      '2027-02-29',
      '2028-02-30',
      '1899-12-31',
      '2028-13-01',
      '2028-01-01T00:00:00Z',
    ])
      expect(
        validate('nodia_rental_reservations_prepare_create', { check_in_on }),
      ).toBe(false);
    for (const cancelled_at of [
      '2028-02-30T12:00:00Z',
      '2028-02-29T24:00:00Z',
      '2028-02-29T12:00:00',
      '2028-02-29T12:00:00.1234Z',
    ])
      expect(
        validate('nodia_rental_reservations_prepare_cancel', { cancelled_at }),
      ).toBe(false);
    for (const check_in_time of ['24:00', '12:60', '12:00:00', null])
      expect(
        validate('nodia_rental_reservations_prepare_create', { check_in_time }),
      ).toBe(false);
    expect(
      validate('nodia_rental_properties_prepare_create', { max_guests: 1001 }),
    ).toBe(false);
    expect(
      validate('nodia_rental_properties_prepare_create', {
        minimum_turnover_minutes: 10081,
      }),
    ).toBe(false);
    expect(
      validate('nodia_rental_properties_prepare_create', {
        default_deposit_percent: '100.01',
      }),
    ).toBe(false);
    expect(
      validate('nodia_rental_properties_prepare_create', { name: ' ' }),
    ).toBe(false);
    expect(
      validate('nodia_rental_properties_prepare_create', {
        notes: 'x'.repeat(5001),
      }),
    ).toBe(false);
    expect(
      validate('nodia_rental_properties_prepare_create', {
        timezone: 'x'.repeat(65),
      }),
    ).toBe(false);
  });
  it('closes nested policies and rules with native array cardinalities and unique identities', () => {
    const confirm = 'nodia_rental_reservations_prepare_confirm';
    for (const platform_policy of [
      {},
      { reference: 'x' },
      { ...platform, sql: 'select' },
      { ...platform, description: '' },
      null,
    ])
      expect(validate(confirm, { platform_policy })).toBe(false);
    expect(
      validate('nodia_rental_payments_prepare_create', {
        platform_policy: { ...platform, secret: 'x' },
      }),
    ).toBe(false);
    expect(validate(confirm, { same_day_approvals: ['1', '1'] })).toBe(false);
    expect(
      validate(confirm, {
        same_day_approvals: Array.from({ length: 101 }, (_, i) =>
          String(i + 1),
        ),
      }),
    ).toBe(false);
    expect(validate(confirm, { same_day_approvals: [] })).toBe(true);
    const policy = 'nodia_rental_cancellation_policies_prepare_create';
    for (const rules of [
      [],
      Array.from({ length: 101 }, () => ({
        min_days_before: 0,
        refund_percent: '0',
      })),
      [{}],
      [{ min_days_before: 36501, refund_percent: '0' }],
      [{ min_days_before: 0, refund_percent: '100.01' }],
      [{ min_days_before: 0, refund_percent: '0', id: '1' }],
    ])
      expect(validate(policy, { rules })).toBe(false);
    expect(
      validate('nodia_rental_reservations_prepare_cancel', {
        expected_refund_amount: '0',
      }),
    ).toBe(false);
    expect(
      validate('nodia_rental_reservations_prepare_create', { id: '1' }),
    ).toBe(false);
    expect(
      validate('nodia_rental_reservations_prepare_start', {
        paid_on: '2028-02-29',
      }),
    ).toBe(false);
    expect(
      validate('nodia_rental_turnovers_prepare_approve_same_day', {
        linen_ready: true,
      }),
    ).toBe(false);
  });
});
