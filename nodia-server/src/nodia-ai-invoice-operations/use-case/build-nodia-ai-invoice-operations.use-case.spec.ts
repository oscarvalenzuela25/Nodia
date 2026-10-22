import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { CreateInvoiceUseCase } from '../../invoice/use-case/create-invoice.use-case.js';
import type { UpdateInvoiceUseCase } from '../../invoice/use-case/update-invoice.use-case.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiNativeOperation } from '../../nodia-ai-proposal/types/native-operation.types.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiInvoiceOperationsService } from '../nodia-ai-invoice-operations.service.js';
import { BuildNodiaAiInvoiceOperationsUseCase } from './build-nodia-ai-invoice-operations.use-case.js';
import { NodiaAiInvoiceOperationsModule } from '../nodia-ai-invoice-operations.module.js';
import { InvoicePersistenceModule } from '../../invoice/invoice-persistence.module.js';
import { NodiaAiRuntimePolicyModule } from '../../nodia-ai-runtime/config/runtime-policy.module.js';

const business = '11111111-1111-4111-8111-111111111111';
const destination = '22222222-2222-4222-8222-222222222222';
const policy = JSON.parse(
  readFileSync(
    new URL(
      '../../nodia-ai-runtime/config/runtime-policy.json',
      import.meta.url,
    ),
    'utf8',
  ),
).policy as NodiaAiRuntimePolicy;
function fixture() {
  const target: NodiaAiJsonObject = {
    id: '7',
    business_id: business,
    provider_id: '8',
    code: 'INV-1',
    total_amount: 12,
    data: { items: [{ name: 'Zero', quantity: 0, tax: null }] },
    is_active: true,
    path_storage: `invoices/${business}/synthetic.pdf`,
    updated_at: '2026-10-17 12:00:00.123456',
  };
  const businesses: NodiaAiJsonObject[] = [business, destination].map((id) => ({
    id,
    owner_id: '99',
    name: id,
    is_active: true,
    updated_at: '2026-10-17 12:00:00.123456',
  }));
  const provider: NodiaAiJsonObject = {
    id: '8',
    business_id: business,
    name: 'Supplier',
    is_active: true,
    updated_at: '2026-10-17 12:00:00.123456',
  };
  const attachment: NodiaAiJsonObject = {
    attachment_id: '55555555-5555-4555-8555-555555555555',
    conversation_id: '44444444-4444-4444-8444-444444444444',
    retention_epoch: '1',
    kind: 'pdf',
    file_name: 'Invoice.pdf',
    media_type: 'application/pdf',
    byte_count: '100',
    content_hash: 'a'.repeat(64),
  };
  let exists = true;
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes('FROM nodia_ai_attachments'))
      return [structuredClone(attachment)];
    if (sql.includes('FROM nodia_ai_execution_steps')) return [];
    if (sql.includes('FROM invoices'))
      return exists ? [structuredClone(target)] : [];
    if (sql.includes('FROM businesses'))
      return businesses
        .filter((item) => (args[0] as string[]).includes(String(item.id)))
        .map((item) => structuredClone(item));
    if (sql.includes('FROM providers'))
      return args[0] === provider.id ? [structuredClone(provider)] : [];
    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const context: ProposalPreparerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: '33333333-3333-4333-8333-333333333333',
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/tools/business'],
    conversationId: '44444444-4444-4444-8444-444444444444',
    maxCollectionItems: 128,
  };
  const create = vi.fn(async (dto: { business_id: string }) => ({
    id: '10',
    business_id: dto.business_id,
  }));
  const update = vi.fn(async (id: string, dto: { business_id?: string }) => ({
    id,
    business_id: dto.business_id ?? business,
  }));
  const factory = new BuildNodiaAiInvoiceOperationsUseCase(
    new NodiaAiInvoiceOperationsService(),
    { execute: create } as unknown as CreateInvoiceUseCase,
    { execute: update } as unknown as UpdateInvoiceUseCase,
    policy,
  );
  return {
    target,
    attachment,
    businesses,
    provider,
    query,
    manager,
    context,
    create,
    update,
    operations: factory.operations,
    missing: () => {
      exists = false;
    },
  };
}
async function prepared(
  op: NodiaAiNativeOperation,
  input: NodiaAiJsonObject,
  context: ProposalPreparerContext,
): Promise<StoredProposalStep> {
  const result = Object.hasOwn(input, 'schema_version')
    ? await op.reprepareStored(input, context)
    : await op.prepare(input, context);
  if (result.status !== 'ready') throw new Error('Expected ready');
  return {
    ...result,
    id: 'step-1',
    toolName: op.toolName,
    contractHash: op.contractHash,
    position: 0,
    outputBindings: [],
  };
}

describe('BuildNodiaAiInvoiceOperationsUseCase', () => {
  it('uses existing Spanish and English translations for every registered human review label', () => {
    const translations = ['es', 'en'].map(
      (locale) =>
        JSON.parse(
          readFileSync(
            new URL(
              `../../../../nodia-client/src/translate/${locale}/nodiaAi.json`,
              import.meta.url,
            ),
            'utf8',
          ),
        ) as { proposal: { business_fields: Record<string, string> } },
    );
    for (const op of fixture().operations) {
      for (const field of op.reviewFields ?? []) {
        expect(field.label_key).toBe(
          `nodiaAi:proposal.business_fields.${field.field_key}`,
        );
        for (const translation of translations)
          expect(translation.proposal.business_fields[field.field_key]).toMatch(
            /\S/,
          );
      }
    }
  });
  it('composes SQL invoice operations without importing OCR or its upload recovery daemon', () => {
    expect(
      Reflect.getMetadata('imports', NodiaAiInvoiceOperationsModule),
    ).toEqual([InvoicePersistenceModule, NodiaAiRuntimePolicyModule]);
    const names = (
      Reflect.getMetadata('providers', InvoicePersistenceModule) as Function[]
    ).map((provider) => provider.name);
    expect(names).toEqual([
      'InvoiceService',
      'CreateInvoiceUseCase',
      'UpdateInvoiceUseCase',
      'RecoverInvoiceUploadsUseCase',
    ]);
    expect(names).not.toContain('InvoiceUploadRecoveryWorker');
  });
  it('registers only the two existing invoice writers, without deletion or upload', () => {
    expect(fixture().operations.map((op) => op.toolName)).toEqual([
      'nodia_invoices_prepare_create',
      'nodia_invoices_prepare_update',
    ]);
  });
  it('asks for required code and merges a clarification without changing business identity', async () => {
    const f = fixture();
    const op = f.operations[0];
    const partial = await op.prepare({ business_id: business }, f.context);
    expect(partial.status).toBe('needs_clarification');
    if (partial.status !== 'needs_clarification') return;
    expect(partial.missingFields).toEqual(['code']);
    const result = await op.prepare(
      { code: 'INV-2' },
      f.context,
      partial.partial,
    );
    expect(result.status).toBe('ready');
    await expect(
      op.prepare(
        { business_id: destination, code: 'changed' },
        f.context,
        partial.partial,
      ),
    ).rejects.toThrow('invalid_input');
  });
  it('freezes explicit native defaults, zero and recursively tagged data without exposing an object key', async () => {
    const f = fixture();
    const step = await prepared(
      f.operations[0],
      {
        business_id: business,
        code: 'INV-2',
        data: { items: [{ quantity: 0, note: null }] },
      },
      f.context,
    );
    expect(step.commandTemplate.command).toEqual({
      code: 'INV-2',
      provider_id: null,
      total_amount: 0,
      data: { items: [{ quantity: 0, note: null }] },
      is_active: true,
    });
    expect(step.preconditions.destination_business_id).toBe(business);
    expect(JSON.stringify(step.publicStep)).not.toMatch(/invoices\//);
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'data',
        after: {
          kind: 'object',
          fields: [
            {
              field_key: 'items',
              value: {
                kind: 'array',
                items: [
                  {
                    kind: 'object',
                    fields: [
                      { field_key: 'quantity', value: 0 },
                      { field_key: 'note', value: null },
                    ],
                  },
                ],
              },
            },
          ],
        },
      }),
    );
  });
  it.each([
    { total_amount: 'invalid' },
    { total_amount: '0' },
    { total_amount: null },
    { total_amount: -1 },
    { total_amount: 0.5 },
    { total_amount: 2147483648 },
    { data: '{broken' },
    { data: [] },
    { data: null },
    { is_active: 'false' },
    { provider_id: 8 },
    { provider_id: '0' },
    { code: '' },
    { code: 'x'.repeat(256) },
    { file: 'arbitrary' },
    { path_storage: 'invoices/other.pdf' },
    { url: 'https://example.invalid' },
  ])(
    'rejects malformed or storage-controlling command %j before querying',
    async (command) => {
      const f = fixture();
      await expect(
        f.operations[0].prepare(
          { business_id: business, code: 'INV', ...command },
          f.context,
        ),
      ).rejects.toThrow('invalid_input');
      expect(f.query).not.toHaveBeenCalled();
      expect(f.create).not.toHaveBeenCalled();
    },
  );
  it('rejects undefined, nonfinite, depth and collection overflow instead of silently dropping data', async () => {
    const f = fixture();
    for (const data of [
      { missing: undefined },
      { bad: Number.NaN },
      { array: Array(129).fill(0) },
    ])
      await expect(
        f.operations[0].prepare(
          {
            business_id: business,
            code: 'INV',
            data: data as unknown as NodiaAiJsonObject,
          },
          f.context,
        ),
      ).rejects.toThrow();
    let data: NodiaAiJsonObject = {};
    for (let i = 0; i < 20; i++) data = { nested: data };
    await expect(
      f.operations[0].prepare(
        { business_id: business, code: 'INV', data },
        f.context,
      ),
    ).rejects.toThrow();
  });
  it('requires a transaction and assigned destination module', async () => {
    const f = fixture();
    await expect(
      f.operations[0].prepare(
        { business_id: business, code: 'INV' },
        { ...f.context, moduleRoutes: [] },
      ),
    ).rejects.toThrow('capability_denied');
    await expect(
      f.operations[0].prepare(
        { business_id: business, code: 'INV' },
        { ...f.context, manager: {} as EntityManager },
      ),
    ).rejects.toThrow('transaction_required');
    expect(f.query).not.toHaveBeenCalled();
  });
  it('preserves authorized global access without requiring business ownership or changing it', async () => {
    const f = fixture();
    const step = await prepared(
      f.operations[0],
      { business_id: business, code: 'INV' },
      f.context,
    );
    expect(await f.operations[0].executeConfirmed(step, f.context)).toEqual({
      id: '10',
      businessId: business,
    });
    expect(f.create).toHaveBeenCalledWith(
      expect.objectContaining({ business_id: business, path_storage: '' }),
      undefined,
      f.manager,
    );
  });
  it('preserves file association and replaces data exactly using the inherited writer manager', async () => {
    const f = fixture();
    const op = f.operations[1];
    const step = await prepared(
      op,
      {
        business_id: business,
        id: '7',
        data: {},
        is_active: false,
        total_amount: 0,
      },
      f.context,
    );
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'file_attached',
        before: true,
        after: true,
      }),
    );
    await op.executeConfirmed(step, f.context);
    expect(f.update).toHaveBeenCalledWith(
      '7',
      { data: {}, is_active: false, total_amount: 0 },
      f.manager,
    );
  });
  it('requires actual changes and an existing target in the source business', async () => {
    const f = fixture();
    expect(
      await f.operations[1].prepare(
        { business_id: business, id: '7' },
        f.context,
      ),
    ).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['changes'],
    });
    await expect(
      f.operations[1].prepare(
        { business_id: destination, id: '7', code: 'INV' },
        f.context,
      ),
    ).rejects.toThrow('invoice_business_mismatch');
    f.missing();
    await expect(
      f.operations[1].prepare(
        { business_id: business, id: '7', code: 'INV' },
        f.context,
      ),
    ).rejects.toThrow('invoice_not_found');
  });
  it('refuses cross-business provider association and absent providers', async () => {
    const f = fixture();
    await expect(
      f.operations[0].prepare(
        { business_id: destination, code: 'INV', provider_id: '8' },
        f.context,
      ),
    ).rejects.toThrow('provider_business_mismatch');
    await expect(
      f.operations[0].prepare(
        { business_id: business, code: 'INV', provider_id: '999' },
        f.context,
      ),
    ).rejects.toThrow('provider_not_found');
  });
  it('freezes an existing file move without inventing metadata or accepting an unstaged effect', async () => {
    const f = fixture();
    const template = {
      business_id: business,
      id: '7',
      destination_business_id: destination,
      provider_id: null,
    };
    const step = await prepared(f.operations[1], template, f.context);
    expect(step.commandTemplate.command).toEqual({
      business_id: destination,
      provider_id: null,
    });
    expect(step.scope.business_id).toBe(business);
    expect(step.preconditions.target).toEqual(f.target);
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'file_preserved',
        before: true,
        after: true,
      }),
    );
    expect(JSON.stringify(step.publicStep)).not.toMatch(
      /invoices\/|content_hash|byte_count|media_type/,
    );
    await expect(
      f.operations[1].executeConfirmed(step, f.context),
    ).rejects.toThrow('invoice_attachment_not_staged');
    expect(f.update).not.toHaveBeenCalled();
  });
  it('rejects a destination alias for creation and malformed transfer destinations', async () => {
    const f = fixture();
    await expect(
      f.operations[0].prepare(
        {
          business_id: business,
          code: 'INV',
          destination_business_id: destination,
        },
        f.context,
      ),
    ).rejects.toThrow('invalid_input');
    for (const value of [null, 7, 'bad'])
      await expect(
        f.operations[1].prepare(
          {
            business_id: business,
            id: '7',
            destination_business_id: value,
            provider_id: null,
          },
          f.context,
        ),
      ).rejects.toThrow('invalid_input');
    expect(f.query).not.toHaveBeenCalled();
  });
  it.each([
    'https://example.invalid/receipt.pdf',
    `invoices/${destination}/other.pdf`,
    `invoices/${business}/../other.pdf`,
    `invoices/${business}/nested/other.pdf`,
    `invoices/${business}/receipt.svg`,
    `invoices/${business}/receipt.pdf?token=secret`,
  ])(
    'rejects a legacy source outside the exact allowed namespace (%s)',
    async (path) => {
      const f = fixture();
      f.target.path_storage = path;
      await expect(
        f.operations[1].reprepareStored(
          {
            schema_version: 1,
            business_id: business,
            id: '7',
            command: { business_id: destination, provider_id: null },
            origins: { business_id: 'user', provider_id: 'user' },
          },
          f.context,
        ),
      ).rejects.toThrow('invoice_file_move_requires_staging');
      expect(f.update).not.toHaveBeenCalled();
    },
  );
  it('consumes only a ready legacy copy with exact source, destination, lease and live upload intent', async () => {
    const f = fixture(),
      op = f.operations[1];
    const preparedStep = await prepared(
      op,
      {
        schema_version: 1,
        business_id: business,
        id: '7',
        command: { business_id: destination, provider_id: null },
        origins: { business_id: 'user', provider_id: 'user' },
      },
      f.context,
    );
    const step = {
      ...preparedStep,
      id: '77777777-7777-4777-8777-777777777777',
    };
    const stage: NodiaAiJsonObject = {
      schema_version: 2,
      kind: 'invoice_attachment_stage',
      status: 'ready',
      source_step_id: step.id,
      attachment_id: null,
      source_storage_key: f.target.path_storage,
      content_hash: 'a'.repeat(64),
      byte_count: '100',
      business_id: destination,
      storage_key: `invoices/${destination}/nodia-ai-${step.id}-1-legacy.pdf`,
      fence: '1',
    };
    const base = f.query.getMockImplementation()!;
    f.query.mockImplementation(async (sql, args = []) => {
      if (sql.includes('SELECT recovery_descriptor'))
        return [{ recovery_descriptor: stage, lease_fence: '1' }];
      if (sql.includes('SELECT storage_key FROM invoice_uploads'))
        return [{ storage_key: stage.storage_key }];
      if (
        sql.startsWith('DELETE FROM invoice_uploads') ||
        sql.startsWith('UPDATE nodia_ai_execution_steps') ||
        sql.includes('INSERT INTO invoice_uploads')
      )
        return [];
      return base(sql, args);
    });
    await expect(op.executeConfirmed(step, f.context)).resolves.toEqual({
      id: '7',
      businessId: destination,
    });
    expect(f.update).toHaveBeenCalledWith(
      '7',
      {
        business_id: destination,
        provider_id: null,
        path_storage: stage.storage_key,
      },
      f.manager,
    );
    expect(f.query).toHaveBeenCalledWith(
      'DELETE FROM invoice_uploads WHERE storage_key=$1',
      [stage.storage_key],
    );
    expect(f.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO invoice_uploads'),
      [f.target.path_storage],
    );
    f.update.mockClear();
    for (const mutate of [
      () => {
        stage.status = 'preparing';
      },
      () => {
        stage.status = 'ready';
        stage.source_storage_key = `invoices/${business}/different.pdf`;
      },
      () => {
        stage.source_storage_key = f.target.path_storage;
        stage.fence = '2';
      },
      () => {
        stage.fence = '1';
        stage.byte_count = '0';
      },
      () => {
        stage.byte_count = '10485761';
      },
      () => {
        stage.byte_count = '100';
        stage.content_hash = null;
      },
      () => {
        stage.content_hash = 'a'.repeat(64);
        stage.extra = true;
      },
    ]) {
      mutate();
      await expect(op.executeConfirmed(step, f.context)).rejects.toThrow(
        'invoice_attachment_not_staged',
      );
    }
    expect(f.update).not.toHaveBeenCalled();
  });
  it('allows a fileless invoice move with both business snapshots and a null provider', async () => {
    const f = fixture();
    f.target.path_storage = '';
    const step = await prepared(
      f.operations[1],
      {
        schema_version: 1,
        business_id: business,
        id: '7',
        command: { business_id: destination, provider_id: null },
        origins: { business_id: 'user', provider_id: 'user' },
      },
      f.context,
    );
    expect(step.preconditions.destination_business_id).toBe(destination);
    expect((step.preconditions.businesses as unknown[]).length).toBe(2);
    expect(await f.operations[1].executeConfirmed(step, f.context)).toEqual({
      id: '7',
      businessId: destination,
    });
  });
  it.each(['code', 'total_amount', 'path_storage', 'data', 'updated_at'])(
    'rejects a changed frozen %s before executing',
    async (field) => {
      const f = fixture();
      const op = f.operations[1];
      const step = await prepared(
        op,
        { business_id: business, id: '7', code: 'INV-new' },
        f.context,
      );
      f.target[field] =
        field === 'data'
          ? { changed: true }
          : field === 'total_amount'
            ? 99
            : 'changed';
      await expect(op.executeConfirmed(step, f.context)).rejects.toThrow(
        'preconditions_changed',
      );
      expect(f.update).not.toHaveBeenCalled();
    },
  );
  it('detects changed provider metadata and business snapshots', async () => {
    for (const entity of ['provider', 'business'] as const) {
      const f = fixture();
      const op = f.operations[1];
      const step = await prepared(
        op,
        { business_id: business, id: '7', code: 'INV-new' },
        f.context,
      );
      (entity === 'provider' ? f.provider : f.businesses[0]).updated_at =
        '2026-10-17 12:00:00.123457';
      await expect(op.verifyPreconditions(step, f.context)).rejects.toThrow(
        'preconditions_changed',
      );
    }
  });
  it('does not require the current target when reauthorizing a historical receipt', async () => {
    const f = fixture();
    const op = f.operations[1];
    const step = await prepared(
      op,
      { business_id: business, id: '7', code: 'INV-new' },
      f.context,
    );
    f.missing();
    const calls = f.query.mock.calls.length;
    await expect(op.verifyAuthority(step, f.context)).resolves.toBeUndefined();
    expect(f.query).toHaveBeenCalledTimes(calls);
  });
  it('rejects another scope, contract, immutable target and unverified native output', async () => {
    const f = fixture();
    const op = f.operations[1];
    const step = await prepared(
      op,
      { business_id: business, id: '7', code: 'INV-new' },
      f.context,
    );
    await expect(
      op.verifyAuthority(
        { ...step, scope: { business_id: destination } },
        f.context,
      ),
    ).rejects.toThrow('capability_denied');
    await expect(
      op.verifyAuthority({ ...step, contractHash: '0'.repeat(64) }, f.context),
    ).rejects.toThrow('capability_denied');
    await expect(
      op.applyEdits(
        step.commandTemplate,
        [{ step_id: 'step-1', field_key: 'id', value: '8' }],
        f.context,
      ),
    ).rejects.toThrow('invalid_input');
    f.update.mockResolvedValueOnce({ id: '999', business_id: business });
    await expect(op.executeConfirmed(step, f.context)).rejects.toThrow(
      'invalid_output',
    );
  });
  it('does not retry an uncertain native write and does not swallow infrastructure failures', async () => {
    const f = fixture();
    const op = f.operations[1];
    const step = await prepared(
      op,
      { business_id: business, id: '7', code: 'INV-new' },
      f.context,
    );
    f.update.mockRejectedValueOnce(new Error('connection lost'));
    await expect(op.executeConfirmed(step, f.context)).rejects.toThrow(
      'connection lost',
    );
    expect(f.update).toHaveBeenCalledTimes(1);
    f.query.mockRejectedValueOnce(new Error('SQL unavailable'));
    await expect(op.verifyPreconditions(step, f.context)).rejects.toThrow(
      'SQL unavailable',
    );
  });
  it('rejects stored envelopes and forged defaults on the untrusted preparation entry point', async () => {
    const f = fixture();
    const op = f.operations[0];
    await expect(
      op.prepare(
        {
          schema_version: 1,
          business_id: business,
          command: { code: 'INV' },
          origins: { code: 'user' },
        },
        f.context,
      ),
    ).rejects.toThrow('invalid_input');
    await expect(
      op.reprepareStored(
        {
          schema_version: 1,
          business_id: business,
          command: { code: 'INV' },
          origins: { code: 'contract_default' },
        },
        f.context,
      ),
    ).rejects.toThrow('invalid_input');
    expect(f.query).not.toHaveBeenCalled();
  });
  it('generates PublicStep projections accepted by the actual closed schema', async () => {
    const schema = JSON.parse(
      readFileSync(
        new URL(
          '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const ajv = new Ajv2020({ strict: false });
    addFormats(ajv);
    ajv.addSchema(schema);
    const check = ajv.compile({ $ref: `${schema.$id}#/$defs/PublicStep` });
    const f = fixture();
    for (const op of f.operations) {
      const step = await prepared(
        op,
        {
          business_id: business,
          ...(op.operation === 'update' ? { id: '7' } : {}),
          code: 'INV-new',
        },
        f.context,
      );
      expect(
        check({
          ...step.publicStep,
          step_id: '55555555-5555-4555-8555-555555555555',
        }),
        JSON.stringify(check.errors),
      ).toBe(true);
    }
  });
});

describe('Invoice attachment proposal boundary', () => {
  it('freezes inspected attachment identity in the exact preview without performing storage I/O', async () => {
    const f = fixture();
    const step = await prepared(
      f.operations[0],
      {
        business_id: business,
        code: 'With file',
        attachment_id: f.attachment.attachment_id,
      },
      f.context,
    );
    expect(step.preconditions.attachment).toEqual(f.attachment);
    expect(step.publicStep.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field_key: 'attachment_content_hash',
          after: 'a'.repeat(64),
        }),
        expect.objectContaining({ field_key: 'file_attached', after: true }),
      ]),
    );
    expect(JSON.stringify(step.publicStep)).not.toContain('storage_key');
    expect(f.create).not.toHaveBeenCalled();
  });
  it('refuses confirmed execution before a separate private stage exists', async () => {
    const f = fixture();
    const step = await prepared(
      f.operations[0],
      {
        business_id: business,
        code: 'No stage',
        attachment_id: f.attachment.attachment_id,
      },
      f.context,
    );
    await expect(
      f.operations[0].executeConfirmed(step, f.context),
    ).rejects.toThrow('invoice_attachment_not_staged');
    expect(f.create).not.toHaveBeenCalled();
  });
  it('treats a material attachment hash change as stale preconditions', async () => {
    const f = fixture();
    const step = await prepared(
      f.operations[0],
      {
        business_id: business,
        code: 'Stale file',
        attachment_id: f.attachment.attachment_id,
      },
      f.context,
    );
    f.attachment.content_hash = 'b'.repeat(64);
    await expect(
      f.operations[0].verifyPreconditions(step, f.context),
    ).rejects.toThrow('preconditions_changed');
  });
});
