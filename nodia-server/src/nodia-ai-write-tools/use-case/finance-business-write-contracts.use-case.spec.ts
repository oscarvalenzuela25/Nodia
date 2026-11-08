import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { PrepareNodiaAiFinanceMovementUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-finance-movement.use-case.js';
import { BuildNodiaAiFinanceCatalogOperationsUseCase } from '../../nodia-ai-finance-catalog/use-case/build-nodia-ai-finance-catalog-operations.use-case.js';
import { BuildNodiaAiFinanceLedgerOperationsUseCase } from '../../nodia-ai-finance-ledger/use-case/build-nodia-ai-finance-ledger-operations.use-case.js';
import { BuildNodiaAiBusinessCatalogOperationsUseCase } from '../../nodia-ai-business-catalog/use-case/build-nodia-ai-business-catalog-operations.use-case.js';
import { BuildNodiaAiSupplierOperationsUseCase } from '../../nodia-ai-supplier-operations/use-case/build-nodia-ai-supplier-operations.use-case.js';
import { BuildNodiaAiInvoiceOperationsUseCase } from '../../nodia-ai-invoice-operations/use-case/build-nodia-ai-invoice-operations.use-case.js';
import { isFinanceBigint } from '../../finance-common/validation/finance-validation.js';

interface ContractTool {
  tool_name: string;
  input_definition: string;
  resource_key: string;
  description: string;
  json_fields?: string[];
}
const contract = JSON.parse(
  readFileSync(
    new URL(
      '../../nodia-ai-products/contracts/write-finance-business.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  schema: NodiaAiJsonObject;
  tools: ContractTool[];
};
const sourceJson = JSON.stringify(contract.schema);
const sha256 = createHash('sha256').update(sourceJson).digest('hex');
const validators = new Map(
  contract.tools.map((tool) => [
    tool.tool_name,
    compileNodiaAiToolSchema({
      sourceJson,
      sha256,
      definition: tool.input_definition,
    }).validate,
  ]),
);
const business = '11111111-1111-4111-8111-111111111111';
const destination = '22222222-2222-4222-8222-222222222222';
const maximum = '9223372036854775807';
const jsonObject: NodiaAiJsonObject = {
  kind: 'object',
  fields: [
    {
      key: 'items',
      value: {
        kind: 'array',
        items: [{ kind: 'number', value: 0 }, { kind: 'null' }],
      },
    },
  ],
};
const prices = {
  code: 'A-1',
  name: 'Artículo',
  cost_price: 10,
  cost_price_tax: 12,
  sale_price: 20,
  stock: 0,
  has_stock: false,
};
const category = { name: 'Comida', key: 'food', is_active: true };
const movement = {
  name: 'Compra',
  amount: maximum,
  type: 'expense',
  status: 'paid',
  category_id: '2',
  is_active: true,
};
const obligation = {
  name: 'Préstamo',
  key: 'loan',
  amount: '10000',
  description: null,
  is_active: true,
};
const contact = {
  name: 'Compras',
  phone: [{ number: '+56987654321' }],
  email: 'compras@example.com',
  schedule: {
    monday: [{ from: '09:00', to: '18:00', description: 'Atención' }],
  },
  description: null,
  is_active: true,
};

const fixtures: Record<string, NodiaAiJsonObject> = {
  nodia_finance_categories_prepare_create: { ...category },
  nodia_finance_categories_prepare_update: { id: '2', ...category },
  nodia_finance_categories_prepare_delete: { id: '2' },
  nodia_finance_category_groups_prepare_create: {
    ...category,
    category_ids: ['2', '3'],
  },
  nodia_finance_category_groups_prepare_update: { id: '4', category_ids: [] },
  nodia_finance_category_groups_prepare_delete: { id: '4' },
  nodia_finance_movements_prepare_create: { ...movement, obligation_id: null },
  nodia_finance_movements_prepare_update: { id: '5', ...movement },
  nodia_finance_movements_prepare_delete: { id: '5' },
  nodia_finance_obligations_prepare_create: {
    ...obligation,
    type: 'loan',
    category_id: '2',
  },
  nodia_finance_obligations_prepare_update: { id: '6', ...obligation },
  nodia_finance_obligations_prepare_delete: { id: '6' },
  nodia_businesses_prepare_create: {
    name: 'Almacén',
    translates: [{ key: 'description', es: '', en: '' }],
  },
  nodia_businesses_prepare_update: {
    business_id: business,
    id: business,
    name: 'Almacén',
  },
  nodia_businesses_prepare_set_collaborators: {
    business_id: business,
    id: business,
    users: [{ user_id: '2', position: null, action_ids: ['7'] }],
  },
  nodia_products_prepare_create: {
    business_id: business,
    ...prices,
    provider_id: null,
    is_active: true,
  },
  nodia_products_prepare_update: {
    business_id: business,
    id: '3',
    command: {
      ...prices,
      business_id: destination,
      provider_id: null,
      is_active: false,
    },
  },
  nodia_product_logs_prepare_create: {
    business_id: business,
    ...prices,
    product_id: '3',
  },
  nodia_product_logs_prepare_update: {
    business_id: business,
    id: destination,
    ...prices,
    product_id: '3',
  },
  nodia_providers_prepare_create: {
    business_id: business,
    name: 'Proveedor',
    tax: 19,
    fields: jsonObject,
    is_active: true,
  },
  nodia_providers_prepare_update: {
    business_id: business,
    id: '7',
    name: 'Proveedor',
    tax: 0,
    fields: jsonObject,
    destination_business_id: destination,
  },
  nodia_provider_contacts_prepare_create: {
    business_id: business,
    provider_id: '7',
    ...contact,
  },
  nodia_provider_contacts_prepare_update: {
    business_id: business,
    provider_id: '7',
    id: '8',
    ...contact,
  },
  nodia_provider_contacts_prepare_set_active: {
    business_id: business,
    provider_id: '7',
    id: '8',
    is_active: false,
  },
  nodia_invoices_prepare_create: {
    business_id: business,
    code: 'INV-1',
    provider_id: null,
    total_amount: 0,
    data: jsonObject,
    is_active: true,
  },
  nodia_invoices_prepare_update: {
    business_id: business,
    id: '9',
    destination_business_id: destination,
    code: 'INV-2',
    provider_id: null,
    total_amount: 2147483647,
    data: jsonObject,
    attachment_id: business,
  },
};

const validate = (name: string, input: unknown) => {
  const validator = validators.get(name);
  if (!validator) throw new Error(`missing-contract:${name}`);
  return validator(input);
};

/** The I/O boundary is deliberately stopped after the actual native decoder.
 * This proves shape compatibility, not DB authorization or effects. */
function nativeFixture() {
  const boundary = new Error('synthetic-domain-read-boundary');
  const read = new Proxy(
    {},
    {
      get: () => () => {
        throw boundary;
      },
    },
  ) as never;
  const execute = vi.fn(() => {
    throw new Error('unexpected-writer');
  });
  const writer = { execute } as never;
  const policy = JSON.parse(
    readFileSync(
      new URL(
        '../../nodia-ai-runtime/config/runtime-policy.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ).policy as NodiaAiRuntimePolicy;
  const operations: NodiaAiProposalPreparer[] = [
    new PrepareNodiaAiFinanceMovementUseCase(read),
    ...new BuildNodiaAiFinanceCatalogOperationsUseCase(
      read,
      read,
      writer,
      writer,
      writer,
      writer,
      writer,
      writer,
    ).operations,
    ...new BuildNodiaAiFinanceLedgerOperationsUseCase(
      read,
      writer,
      writer,
      writer,
      writer,
      writer,
    ).operations,
    ...new BuildNodiaAiBusinessCatalogOperationsUseCase(
      read,
      writer,
      writer,
      writer,
      writer,
      writer,
      writer,
      writer,
    ).operations,
    ...new BuildNodiaAiSupplierOperationsUseCase(
      read,
      writer,
      writer,
      writer,
      writer,
    ).operations,
    ...new BuildNodiaAiInvoiceOperationsUseCase(read, writer, writer, policy)
      .operations,
  ];
  const manager = {
    queryRunner: { isTransactionActive: true },
    query: vi.fn(async (sql: string, parameters: unknown[] = []) => {
      // Synthetic authority frontier only; the actual domain port below still stops.
      if (sql.startsWith('SELECT u.id'))
        return [{ actorId: '1', sessionId: business, isSuperAdmin: true }];
      if (sql.includes('AS authority_locks')) return [{ authority_locks: 9 }];
      if (
        sql.includes('FROM businesses WHERE id=ANY') ||
        sql.includes('FROM businesses business') ||
        sql.includes('resource.id=ANY')
      )
        return (parameters[0] as string[]).map((id) => ({ id }));
      if (
        /^SELECT id::text FROM (?:providers|personal_info_provider) WHERE id=ANY\(\$1::bigint\[\]\) FOR SHARE$/.test(
          sql,
        )
      )
        return (parameters[0] as string[]).map((id) => ({ id }));
      if (sql.startsWith('SET LOCAL') || sql.startsWith('LOCK TABLE'))
        return [];
      throw new Error('unexpected-contract-authority-query');
    }),
  } as unknown as EntityManager;
  const context = {
    actor: { actorId: '1', sessionId: business },
    manager,
    moduleRoutes: ['/finances-personal', '/business'],
    statementTimeoutMs: 1000,
    maxCollectionItems: 128,
  } as unknown as ProposalPreparerContext;
  return { boundary, operations, context, execute };
}

describe('Finance and business MCP write input contracts', () => {
  it('has exactly the 26 native names, one closed definition per tool and explicit JSON adapters', () => {
    const native = nativeFixture();
    expect(contract.tools).toHaveLength(26);
    expect(new Set(contract.tools.map((tool) => tool.tool_name)).size).toBe(26);
    expect(contract.tools.map((tool) => tool.tool_name).sort()).toEqual(
      Object.keys(fixtures).sort(),
    );
    expect(contract.tools.map((tool) => tool.tool_name).sort()).toEqual(
      native.operations.map((operation) => operation.toolName).sort(),
    );
    expect(
      contract.tools
        .filter((tool) => tool.json_fields)
        .map((tool) => [tool.tool_name, tool.json_fields]),
    ).toEqual([
      ['nodia_providers_prepare_create', ['fields']],
      ['nodia_providers_prepare_update', ['fields']],
      ['nodia_invoices_prepare_create', ['data']],
      ['nodia_invoices_prepare_update', ['data']],
    ]);
    for (const tool of contract.tools) {
      expect(tool.description).toMatch(/^Prepara .*no ejecuta cambios\.$/u);
      expect(tool.resource_key).toBe(
        tool.tool_name.slice('nodia_'.length).split('_prepare_')[0],
      );
    }
  });

  it.each(Object.entries(fixtures))(
    '%s admits its exact synthetic command without filling missing values',
    (name, input) => {
      const original = structuredClone(input);
      expect(validate(name, input)).toBe(true);
      expect(input).toEqual(original);
      expect(validate(name, {})).toBe(true);
      for (const forbidden of [
        'api_key',
        'token',
        'schema_version',
        'origins',
        'request_key',
        'version',
        'confirmed',
        'actor_id',
        'transaction',
      ]) {
        expect(
          validate(name, {
            ...input,
            [forbidden]: forbidden === 'schema_version' ? 1 : 'forbidden',
          }),
        ).toBe(false);
      }
    },
  );

  it.each(Object.entries(fixtures))(
    '%s agrees with its native decoder before synthetic domain reads',
    async (name, input) => {
      const native = nativeFixture();
      const operation = native.operations.find(
        (candidate) => candidate.toolName === name,
      )!;
      // JSON decoding belongs to the common adapter; native fixtures below retain
      // the original object and exact zero/null values to check the real decoder.
      const partial = structuredClone(input);
      for (const key of contract.tools.find((tool) => tool.tool_name === name)
        ?.json_fields ?? []) {
        partial[key] = { items: [0, null] };
      }
      try {
        const result = await operation.prepare(partial, native.context);
        expect(name).toBe('nodia_businesses_prepare_create');
        expect(result.status).toBe('ready');
      } catch (error) {
        expect(error).toBe(native.boundary);
      }
      expect(native.execute).not.toHaveBeenCalled();
    },
  );

  it('keeps finance IDs and amounts exact up to signed bigint maximum', () => {
    for (const key of ['owner_id', 'amount', 'category_id', 'obligation_id']) {
      for (const value of ['1', '9007199254740993', maximum]) {
        expect(
          validate('nodia_finance_movements_prepare_create', { [key]: value }),
        ).toBe(true);
      }
      for (const value of [
        0,
        1,
        9007199254740992,
        '0',
        '-1',
        '+1',
        '01',
        '1.1',
        '1e3',
        '',
        '9223372036854775808',
        '9999999999999999999',
        '10000000000000000000',
      ]) {
        expect(
          validate('nodia_finance_movements_prepare_create', { [key]: value }),
        ).toBe(false);
      }
    }
    expect(
      validate('nodia_finance_movements_prepare_create', {
        obligation_id: null,
      }),
    ).toBe(true);
    expect(
      validate('nodia_finance_movements_prepare_update', {
        obligation_id: '2',
      }),
    ).toBe(false);
    expect(
      validate('nodia_finance_obligations_prepare_update', { type: 'debt' }),
    ).toBe(false);
    expect(
      validate('nodia_finance_obligations_prepare_update', {
        category_id: '2',
      }),
    ).toBe(false);
    // Every decimal prefix boundary of PostgreSQL bigint, including adjacent
    // values, is compared with the actual native validator without Number.
    const edges = new Set<string>(['0', maximum, '9223372036854775808']);
    for (let length = 1; length <= maximum.length; length++) {
      const prefix = BigInt(maximum.slice(0, length));
      for (const offset of [-1n, 0n, 1n]) {
        const value = (prefix + offset).toString().padEnd(maximum.length, '0');
        edges.add(value);
        edges.add(value.slice(0, length));
      }
    }
    for (const value of edges)
      expect(
        validate('nodia_finance_movements_prepare_create', { amount: value }),
        value,
      ).toBe(isFinanceBigint(value));
  });

  it('preserves native enums, nullable fields and field omission', () => {
    for (const type of ['income', 'expense'])
      expect(validate('nodia_finance_movements_prepare_create', { type })).toBe(
        true,
      );
    for (const status of ['pending', 'received', 'paid', 'cancelled'])
      expect(
        validate('nodia_finance_movements_prepare_create', { status }),
      ).toBe(true);
    for (const type of ['loan', 'debt'])
      expect(
        validate('nodia_finance_obligations_prepare_create', { type }),
      ).toBe(true);
    for (const invalid of [
      { type: 'refund' },
      { status: 'done' },
      { amount: null },
      { category_id: null },
      { is_active: null },
      { name: '' },
      { name: '  ' },
      { name: 'x'.repeat(256) },
    ])
      expect(validate('nodia_finance_movements_prepare_create', invalid)).toBe(
        false,
      );
    expect(
      validate('nodia_finance_obligations_prepare_create', {
        description: null,
      }),
    ).toBe(true);
    expect(
      validate('nodia_finance_obligations_prepare_create', { description: '' }),
    ).toBe(true);
    expect(
      validate('nodia_finance_obligations_prepare_create', {
        description: 'x'.repeat(5001),
      }),
    ).toBe(false);
    expect(
      validate('nodia_finance_categories_prepare_create', { id: '1' }),
    ).toBe(false);
  });

  it('caps unique finance group members at the native 100, independently of the general 128 limit', () => {
    const category_ids = Array.from({ length: 100 }, (_, index) =>
      String(index + 1),
    );
    expect(
      validate('nodia_finance_category_groups_prepare_create', {
        category_ids,
      }),
    ).toBe(true);
    expect(
      validate('nodia_finance_category_groups_prepare_create', {
        category_ids: [...category_ids, '101'],
      }),
    ).toBe(false);
    expect(
      validate('nodia_finance_category_groups_prepare_create', {
        category_ids: ['1', '1'],
      }),
    ).toBe(false);
    expect(
      validate('nodia_finance_category_groups_prepare_create', {
        category_ids: ['9223372036854775808'],
      }),
    ).toBe(false);
    expect(
      validate('nodia_finance_category_groups_prepare_create', {
        category_ids: [],
      }),
    ).toBe(true);
  });

  it('uses UUID product-log IDs and bigint product IDs, retaining origin and destination separately', () => {
    expect(
      validate('nodia_product_logs_prepare_update', { id: business }),
    ).toBe(true);
    expect(validate('nodia_product_logs_prepare_update', { id: '3' })).toBe(
      false,
    );
    expect(
      validate('nodia_products_prepare_update', {
        id: maximum,
        business_id: business,
        command: { business_id: destination },
      }),
    ).toBe(true);
    expect(
      validate('nodia_products_prepare_update', {
        business_id: business,
        command: { business_id: '3' },
      }),
    ).toBe(false);
    expect(
      validate('nodia_products_prepare_update', {
        command: { api_key: 'secret' },
      }),
    ).toBe(false);
    expect(
      validate('nodia_products_prepare_update', {
        command: { schema_version: 1 },
      }),
    ).toBe(false);
    expect(
      validate('nodia_products_prepare_create', {
        business_id: '00000000-0000-0000-0000-000000000000',
      }),
    ).toBe(true);
    expect(
      validate('nodia_products_prepare_create', {
        business_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      }),
    ).toBe(true);
    expect(
      validate('nodia_invoices_prepare_create', {
        attachment_id: '00000000-0000-0000-0000-000000000000',
      }),
    ).toBe(false);
    expect(
      validate('nodia_invoices_prepare_create', { attachment_id: business }),
    ).toBe(true);
  });

  it('keeps native int32 prices and stock without coercion, rounding or fabricated positivity', () => {
    for (const value of [-2147483648, 0, 2147483647])
      expect(
        validate('nodia_products_prepare_create', { cost_price: value }),
      ).toBe(true);
    for (const value of [-2147483649, 2147483648, 1.1, '10', null])
      expect(
        validate('nodia_products_prepare_create', { cost_price: value }),
      ).toBe(false);
    expect(validate('nodia_products_prepare_create', { stock: -1 })).toBe(
      false,
    );
    expect(validate('nodia_invoices_prepare_create', { total_amount: 0 })).toBe(
      true,
    );
    expect(
      validate('nodia_invoices_prepare_create', { total_amount: '0' }),
    ).toBe(false);
    expect(
      validate('nodia_invoices_prepare_create', { total_amount: -1 }),
    ).toBe(false);
    expect(validate('nodia_providers_prepare_create', { tax: 100 })).toBe(true);
    expect(validate('nodia_providers_prepare_create', { tax: 101 })).toBe(
      false,
    );
  });

  it('closes translations and collaborators at every level with bounded native collections', () => {
    const name = 'nodia_businesses_prepare_create';
    expect(
      validate(name, { translates: [{ key: 'description', es: '', en: '' }] }),
    ).toBe(true);
    expect(
      validate(name, { translates: [{ key: 'title', es: '', en: 'Title' }] }),
    ).toBe(false);
    expect(
      validate(name, {
        translates: [{ key: 'description', es: '', en: '', api_key: 'secret' }],
      }),
    ).toBe(false);
    expect(
      validate(name, {
        translates: [{ key: 'description', es: null, en: '' }],
      }),
    ).toBe(false);
    const user = { user_id: maximum, action_ids: ['1'] };
    expect(
      validate('nodia_businesses_prepare_set_collaborators', { users: [user] }),
    ).toBe(true);
    expect(
      validate('nodia_businesses_prepare_set_collaborators', { users: [] }),
    ).toBe(false);
    expect(
      validate('nodia_businesses_prepare_set_collaborators', {
        users: [{ ...user, action_ids: ['1', '1'] }],
      }),
    ).toBe(false);
    expect(
      validate('nodia_businesses_prepare_set_collaborators', {
        users: [{ ...user, action_ids: ['1'], roles: ['super_admin'] }],
      }),
    ).toBe(false);
    expect(
      validate('nodia_businesses_prepare_set_collaborators', {
        users: Array.from({ length: 129 }, () => user),
      }),
    ).toBe(false);
  });

  it('constrains contact phones, schedules, email and replacement-only fields', () => {
    const name = 'nodia_provider_contacts_prepare_create';
    expect(
      validate(name, { phone: [], schedule: {}, email: '', description: null }),
    ).toBe(true);
    expect(
      validate(name, { phone: [{ number: '+56987654321', token: 'x' }] }),
    ).toBe(false);
    expect(validate(name, { phone: [{ number: '912345678' }] })).toBe(false);
    expect(
      validate(name, {
        phone: Array.from({ length: 11 }, (_, index) => ({
          number: `+569123456${String(index).padStart(2, '0')}`,
        })),
      }),
    ).toBe(false);
    expect(
      validate(name, {
        phone: [{ number: '+56987654321' }, { number: '+56987654321' }],
      }),
    ).toBe(false);
    expect(validate(name, { schedule: { holiday: [] } })).toBe(false);
    expect(
      validate(name, {
        schedule: { monday: [{ from: '24:00', to: '25:00' }] },
      }),
    ).toBe(false);
    expect(
      validate(name, {
        schedule: { monday: [{ from: '09:00', to: '18:00', secret: 'x' }] },
      }),
    ).toBe(false);
    expect(validate(name, { email: 'not-an-email' })).toBe(false);
    expect(
      validate('nodia_provider_contacts_prepare_set_active', {
        name: 'Changed',
      }),
    ).toBe(false);
    expect(
      validate('nodia_provider_contacts_prepare_set_active', {
        request_key: business,
        version: 1,
      }),
    ).toBe(false);
  });

  it('keeps native semantic contact checks after structural JSON Schema admission', async () => {
    const fixture = nativeFixture();
    const operation = fixture.operations.find(
      (item) => item.toolName === 'nodia_provider_contacts_prepare_create',
    )!;
    // Schema validates E.164 structure and HH:mm; the native product retains
    // territory-aware phone metadata and ordered intervals as the single rule.
    const partials: NodiaAiJsonObject[] = [
      { phone: [{ number: '+56912345678' }] },
      { schedule: { monday: [{ from: '18:00', to: '09:00' }] } },
      { schedule: { monday: [{ from: '09:00', to: '09:00' }] } },
    ];
    for (const partial of partials) {
      expect(validate(operation.toolName, partial)).toBe(true);
      await expect(operation.prepare(partial, fixture.context)).rejects.toThrow(
        /^Invalid contact (phone|schedule)$/u,
      );
    }
    expect(fixture.execute).not.toHaveBeenCalled();
  });

  it('represents flexible domain JSON with closed typed nodes, preserving zero, null and nested arrays', () => {
    expect(
      validate('nodia_providers_prepare_create', { fields: jsonObject }),
    ).toBe(true);
    expect(
      validate('nodia_invoices_prepare_create', { data: jsonObject }),
    ).toBe(true);
    for (const fields of [
      { items: [0, null] },
      {
        kind: 'object',
        fields: [{ key: 'x', value: { kind: 'number', value: '0' } }],
      },
      {
        kind: 'object',
        fields: [{ key: 'x', value: { kind: 'null', value: null } }],
      },
      {
        kind: 'object',
        fields: [
          { key: 'x', value: { kind: 'object', fields: [], unchecked: true } },
        ],
      },
      {
        kind: 'object',
        fields: Array.from({ length: 129 }, (_, index) => ({
          key: String(index),
          value: { kind: 'null' },
        })),
      },
    ]) {
      expect(validate('nodia_providers_prepare_create', { fields })).toBe(
        false,
      );
    }
    expect(
      validate('nodia_invoices_prepare_create', {
        path_storage: 'private/path',
      }),
    ).toBe(false);
    expect(validate('nodia_invoices_prepare_create', { data: null })).toBe(
      false,
    );
  });
});
