import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { CreateProviderUseCase } from '../../provider/use-case/create-provider.use-case.js';
import { UpdateProviderUseCase } from '../../provider/use-case/update-provider.use-case.js';
import { ProviderService } from '../../provider/provider.service.js';
import { ProviderContactService } from '../../provider-contact/provider-contact.service.js';
import { CreateProviderContactUseCase } from '../../provider-contact/use-case/create-provider-contact.use-case.js';
import { UpdateProviderContactUseCase } from '../../provider-contact/use-case/update-provider-contact.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { NodiaAiSupplierOperationsService } from '../nodia-ai-supplier-operations.service.js';
import { BuildNodiaAiSupplierOperationsUseCase } from './build-nodia-ai-supplier-operations.use-case.js';
const business = '11111111-1111-4111-8111-111111111111';
const destination = '22222222-2222-4222-8222-222222222222';
function fixture() {
  const visibleBusinesses = new Set([business, destination]);
  let superAdmin = false;
  const provider: NodiaAiJsonObject = {
    id: '7',
    business_id: business,
    name: 'supplier',
    tax: 19,
    fields: { price: 'Precio' },
    is_active: true,
    updated_at: '2026-10-17 12:00:00.123456',
  };
  const contact: NodiaAiJsonObject = {
    id: '8',
    provider_id: '7',
    name: 'María',
    phone: [{ number: '+56987654321' }],
    email: 'a@example.com',
    schedule: { monday: [{ from: '09:00', to: '12:00' }] },
    description: 'Existing',
    is_active: true,
    version: 1,
    updated_at: '2026-10-17 12:00:00.123456+00',
  };
  let blockedTransfer = false;
  let authenticated = true,
    exists = true,
    contactExists = true;
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    const visible = (id: string) => superAdmin || visibleBusinesses.has(id);
    if (sql.includes('authority_locks')) return [{ authority_locks: 9 }];
    if (sql.includes('FROM businesses WHERE id=ANY'))
      return (params[0] as string[]).map((id) => ({ id }));
    if (sql.includes('FROM businesses business'))
      return (params[0] as string[]).filter(visible).map((id) => ({ id }));
    if (sql.startsWith('SELECT id::text FROM providers WHERE id=ANY'))
      return exists && (params[0] as string[]).includes(String(provider.id))
        ? [{ id: provider.id }]
        : [];
    if (
      sql.startsWith('SELECT id::text FROM personal_info_provider WHERE id=ANY')
    )
      return contactExists &&
        (params[0] as string[]).includes(String(contact.id))
        ? [{ id: contact.id }]
        : [];
    if (sql.includes('FROM providers resource'))
      return exists && visible(String(provider.business_id))
        ? [{ id: provider.id }]
        : [];
    if (sql.includes('FROM personal_info_provider resource'))
      return contactExists &&
        exists &&
        contact.provider_id === provider.id &&
        visible(String(provider.business_id))
        ? [{ id: contact.id }]
        : [];
    if (sql.includes('AS product_count'))
      return [
        { product_count: blockedTransfer ? '1' : '0', invoice_count: '0' },
      ];
    if (sql.startsWith('SELECT u.id'))
      return authenticated
        ? [{ actorId: '1', sessionId: business, isSuperAdmin: superAdmin }]
        : [];
    if (sql.includes('FROM businesses WHERE'))
      return [
        {
          id: params[0],
          name: 'Business',
          owner_id: '2',
          is_active: true,
          updated_at: '2026-10-17 00:00:00.123456',
        },
      ];
    if (sql.includes('FROM providers WHERE'))
      return exists &&
        params[0] === provider.business_id &&
        params[1] === provider.id
        ? [structuredClone(provider)]
        : [];
    if (sql.includes('FROM personal_info_provider'))
      return contactExists &&
        params[0] === contact.provider_id &&
        params[1] === contact.id
        ? [structuredClone(contact)]
        : [];
    return [];
  });
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const providerService = {
    transaction: vi.fn(async (transaction, work) =>
      work(transaction ?? manager),
    ),
    scopes: vi.fn(async () => [
      { id: '1', business_id: '11111111-1111-4111-8111-111111111111' },
    ]),
    lockBusinesses: vi.fn(async () => undefined),
    assertBusinessAccess: vi.fn(async () => undefined),
    lockProvider: vi.fn(async () => structuredClone(provider)),
    create: vi.fn(async (dto) => ({ ...dto, id: '10' })),
    update: vi.fn(async (id, dto) => ({ ...provider, ...dto, id })),
  };
  const contactService = {
    withAccess: vi.fn(async (_provider, _actor, transaction, work) =>
      work(transaction),
    ),
    providerExists: vi.fn(async () => true),
    createOnce: vi.fn(
      async (provider_id, creation_key, creation_hash, values) => ({
        ...values,
        id: '11',
        provider_id,
        creation_key,
        creation_hash,
        version: 1,
      }),
    ),
    find: vi.fn(async () => structuredClone(contact)),
    updateVersion: vi.fn(async (_provider, _id, _version, values) => {
      Object.assign(contact, values, { version: Number(contact.version) + 1 });
      return true;
    }),
  };
  const factory = new BuildNodiaAiSupplierOperationsUseCase(
    new NodiaAiSupplierOperationsService(),
    new CreateProviderUseCase(providerService as unknown as ProviderService),
    new UpdateProviderUseCase(providerService as unknown as ProviderService),
    new CreateProviderContactUseCase(
      contactService as unknown as ProviderContactService,
    ),
    new UpdateProviderContactUseCase(
      contactService as unknown as ProviderContactService,
    ),
  );
  const context: ProposalPreparerContext = {
    manager,
    actor: {
      actorId: '1',
      sessionId: business,
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/business'],
    conversationId: business,
    maxCollectionItems: 128,
  };
  const op = (name: string) =>
    factory.operations.find((o) => o.toolName === `nodia_${name}`)!;
  async function prepared(name: string, input: NodiaAiJsonObject) {
    const operation = op(name),
      result = await operation.prepare(input, context);
    if (result.status !== 'ready') throw new Error(JSON.stringify(result));
    const step: StoredProposalStep = {
      ...result,
      id: business,
      toolName: operation.toolName,
      contractHash: operation.contractHash,
      position: 0,
      outputBindings: [],
    };
    return { operation, step };
  }
  return {
    blockTransfer: () => {
      blockedTransfer = true;
    },
    provider,
    contact,
    query,
    manager,
    context,
    op,
    prepared,
    providerService,
    contactService,
    setMissing: () => {
      exists = false;
      contactExists = false;
    },
    revoke: () => {
      authenticated = false;
    },
    hideBusiness: (id: string) => visibleBusinesses.delete(id),
    showBusiness: (id: string) => visibleBusinesses.add(id),
    setSuperAdmin: (value = true) => {
      superAdmin = value;
    },
  };
}

describe('Typed future supplier output for a dependent contact', () => {
  async function future() {
    const f = fixture();
    const producer = await f.prepared('providers_prepare_create', {
      business_id: business,
      name: 'supplier',
      fields: { price: 'Precio' },
    });
    const operation = f.op('provider_contacts_prepare_create');
    const incomplete = await operation.prepare(
      { business_id: business, name: 'Contact' },
      f.context,
    );
    if (incomplete.status !== 'needs_clarification')
      throw Error('Expected missing provider');
    const binding = {
      target_field_key: 'provider_id',
      from_step_id: producer.step.id,
      output_key: 'id',
      source: producer.step,
    };
    const result = await operation.prepareWithBindings!(
      incomplete.partial,
      [binding],
      f.context,
    );
    if (result.status !== 'ready')
      throw Error('Expected complete known values');
    const step: StoredProposalStep = {
      ...result,
      id: destination,
      toolName: operation.toolName,
      contractHash: operation.contractHash,
      position: 2,
      outputBindings: [
        {
          target_field_key: 'provider_id',
          from_step_id: producer.step.id,
          output_key: 'id',
        },
      ],
      publicStep: {
        ...result.publicStep,
        step_id: destination,
        depends_on: [producer.step.id],
        output_bindings: [
          {
            target_field_key: 'provider_id',
            from_step_id: producer.step.id,
            output_key: 'id',
          },
        ],
      },
    };
    return { ...f, producer, operation, incomplete, binding, step };
  }
  it('prepares all known contact values without inventing or querying a provider ID', async () => {
    const f = await future();
    expect(f.step.commandTemplate.provider_id).toBeUndefined();
    expect(f.step.scope).toEqual({ business_id: business });
    expect(f.step.publicStep.changes).toContainEqual({
      field_key: 'provider_id',
      before: null,
      before_present: false,
      after: null,
      after_present: false,
      origin: 'future_step',
    });
    expect(
      f.query.mock.calls.filter(([sql]) =>
        sql.includes('FROM providers WHERE'),
      ),
    ).toHaveLength(0);
    expect(f.contactService.createOnce).not.toHaveBeenCalled();
    expect(
      (f.step.commandTemplate.command as NodiaAiJsonObject).request_key,
    ).toEqual((f.incomplete.partial.command as NodiaAiJsonObject).request_key);
  });
  it('binds a verified exact ID once without changing contact payload or native intent key', async () => {
    const f = await future();
    const bound = await f.operation.bindOutputs!(
      f.step,
      { provider_id: { value: '7', source: f.producer.step } },
      f.context,
    );
    expect(bound.commandTemplate.provider_id).toBe('7');
    expect(bound.commandTemplate.command).toEqual(
      f.step.commandTemplate.command,
    );
    expect(bound.scope).toEqual({ business_id: business, provider_id: '7' });
    expect(bound.publicStep).toEqual(f.step.publicStep);
    expect(bound.preconditions.provider).toEqual(f.provider);
    expect(f.contactService.createOnce).not.toHaveBeenCalled();
  });
  it('rejects a producer materially changed after its committed creation', async () => {
    const f = await future();
    f.provider.name = 'changed';
    await expect(
      f.operation.bindOutputs!(
        f.step,
        { provider_id: { value: '7', source: f.producer.step } },
        f.context,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.contactService.createOnce).not.toHaveBeenCalled();
  });
  it('can freshly prepare a new contact proposal from a known receipt ID after a parent change, without relaxing strict old binding', async () => {
    const f = await future();
    f.provider.name = 'changed after commit';
    await expect(
      f.operation.bindOutputs!(
        f.step,
        { provider_id: { value: '7', source: f.producer.step } },
        f.context,
      ),
    ).rejects.toMatchObject({ status: 409 });
    const result = await f.operation.reprepareStored!(
      { ...f.step.commandTemplate, provider_id: '7' },
      f.context,
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw Error('Expected ready');
    expect(result.preconditions.provider).toEqual(f.provider);
    expect(result.commandTemplate.command).toEqual(
      f.step.commandTemplate.command,
    );
    expect(result.scope).toEqual({ business_id: business, provider_id: '7' });
    expect(f.contactService.createOnce).not.toHaveBeenCalled();
  });
  it.each(['absent', 'moved', 'cross-business'] as const)(
    'rejects fresh receipt-based preparation if the provider is %s',
    async (kind) => {
      const f = await future();
      if (kind === 'absent') f.setMissing();
      if (kind === 'moved') f.provider.business_id = destination;
      await expect(
        f.operation.reprepareStored!(
          {
            ...f.step.commandTemplate,
            business_id: kind === 'cross-business' ? destination : business,
            provider_id: '7',
          },
          f.context,
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(f.contactService.createOnce).not.toHaveBeenCalled();
    },
  );
  it('rejects an absent materialized provider without guessing another ID', async () => {
    const f = await future();
    await expect(
      f.operation.bindOutputs!(
        f.step,
        { provider_id: { value: '999', source: f.producer.step } },
        f.context,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it.each([
    ['wrong-type', 7],
    ['noncanonical', '07'],
    ['missing', null],
  ])('rejects invalid output %s', async (_name, value) => {
    const f = await future();
    await expect(
      f.operation.bindOutputs!(
        f.step,
        { provider_id: { value, source: f.producer.step } },
        f.context,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('cannot override a concrete provider or use a producer from another business', async () => {
    const f = await future();
    await expect(
      f.operation.prepareWithBindings!(
        { business_id: business, provider_id: '7', name: 'Contact' },
        [f.binding],
        f.context,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      f.operation.prepareWithBindings!(
        { business_id: destination, name: 'Contact' },
        [f.binding],
        f.context,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('cannot replace a provider-create source with an update or change the source identity', async () => {
    const f = await future();
    await expect(
      f.operation.prepareWithBindings!(
        f.incomplete.partial,
        [
          {
            ...f.binding,
            source: {
              ...f.producer.step,
              toolName: 'nodia_providers_prepare_update',
            },
          },
        ],
        f.context,
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      f.operation.bindOutputs!(
        f.step,
        {
          provider_id: {
            value: '7',
            source: { ...f.producer.step, id: destination },
          },
        },
        f.context,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('still requires every other mandatory field and preserves native key when edited', async () => {
    const f = await future();
    const missing = await f.operation.prepareWithBindings!(
      { business_id: business },
      [f.binding],
      f.context,
    );
    expect(missing.status).toBe('needs_clarification');
    if (missing.status === 'needs_clarification')
      expect(missing.missingFields).toEqual(['name']);
    const edited = await f.operation.applyEdits(
      f.step.commandTemplate,
      [{ step_id: f.step.id, field_key: 'name', value: 'Corrected' }],
      f.context,
    );
    const refreshed = await f.operation.reprepareWithBindings!(
      edited,
      [f.binding],
      f.context,
    );
    expect(refreshed.status).toBe('ready');
    if (refreshed.status === 'ready')
      expect(
        (refreshed.commandTemplate.command as NodiaAiJsonObject).request_key,
      ).toBe((f.step.commandTemplate.command as NodiaAiJsonObject).request_key);
  });
});
describe('AI-22 supplier operations', () => {
  it('registers exactly five native operations, excluding bulk, import, and absent delete', () => {
    const f = fixture();
    expect(
      [
        'providers_prepare_create',
        'providers_prepare_update',
        'provider_contacts_prepare_create',
        'provider_contacts_prepare_update',
        'provider_contacts_prepare_set_active',
      ].map((n) => f.op(n).operation),
    ).toEqual(['create', 'update', 'create', 'update', 'set_active']);
  });
  it('clarifies business and name without inventing required values', async () => {
    const f = fixture();
    expect(
      await f.op('providers_prepare_create').prepare({}, f.context),
    ).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['business_id', 'name'],
    });
  });
  it('accepts clarification of a previously absent business without switching an existing scope', async () => {
    const f = fixture(),
      op = f.op('providers_prepare_create');
    const partial = await op.prepare({}, f.context);
    if (partial.status !== 'needs_clarification')
      throw new Error('expected draft');
    expect(
      await op.prepare(
        { business_id: business, name: 'Supplier' },
        f.context,
        partial.partial,
      ),
    ).toMatchObject({ status: 'ready' });
    expect(op.editableFields).not.toHaveProperty('business_id');
  });
  it('persists one backend key across clarification and preserves false and personal name casing', async () => {
    const f = fixture(),
      op = f.op('provider_contacts_prepare_create');
    const first = await op.prepare(
      { business_id: business, provider_id: '7', is_active: false },
      f.context,
    );
    expect(first.status).toBe('needs_clarification');
    if (first.status !== 'needs_clarification') return;
    const result = await op.prepare(
      { name: '  María Pérez  ' },
      f.context,
      first.partial,
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.commandTemplate.command).toMatchObject({
      name: 'María Pérez',
      is_active: false,
      phone: [],
      email: null,
      schedule: {},
      description: null,
      request_key: (first.partial.command as NodiaAiJsonObject).request_key,
    });
  });
  it.each([
    { schema_version: 1, command: {}, origins: {} },
    { request_key: business },
    { version: 1 },
    { arbitrary: true },
    { business_id: null },
    { name: null },
    { tax: null },
    { tax: 101 },
    { tax: 1.5 },
    { fields: null },
    { is_active: null },
    { name: 'x' },
  ])('rejects untrusted or invalid supplier input %j', async (patch) => {
    const f = fixture();
    await expect(
      f
        .op('providers_prepare_create')
        .prepare(
          { business_id: business, name: 'Supplier', ...patch },
          f.context,
        ),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('shows and executes the native provider defaults through the caller transaction', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared('providers_prepare_create', {
        business_id: business,
        name: '  NEW Supplier  ',
        tax: 0,
        is_active: false,
      });
    expect(step.commandTemplate.command).toEqual({
      name: 'new supplier',
      tax: 0,
      is_active: false,
      fields: {},
    });
    expect(await operation.executeConfirmed(step, f.context)).toEqual({
      id: '10',
      businessId: business,
    });
    expect(f.providerService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: business,
        tax: 0,
        is_active: false,
      }),
      f.manager,
      {
        userId: f.context.actor.actorId,
        sessionId: f.context.actor.sessionId,
        transaction: f.manager,
      },
    );
  });
  it('preserves omitted tax and column mappings when updating the supplier name', async () => {
    const f = fixture();
    f.provider.tax = 10;
    const { operation, step } = await f.prepared('providers_prepare_update', {
      business_id: business,
      id: '7',
      name: 'Renamed',
    });
    await operation.executeConfirmed(step, f.context);
    expect(f.providerService.update).toHaveBeenCalledWith(
      '7',
      expect.objectContaining({ name: 'renamed' }),
      f.manager,
      {
        userId: f.context.actor.actorId,
        sessionId: f.context.actor.sessionId,
        transaction: f.manager,
      },
    );
    const command = f.providerService.update.mock.calls[0][1];
    expect(command).not.toHaveProperty('tax');
    expect(command).not.toHaveProperty('fields');
  });
  it('binds source and destination before provider transfer and returns the new scope', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared('providers_prepare_update', {
        business_id: business,
        id: '7',
        destination_business_id: destination,
      });
    expect(step.preconditions.destination_business_id).toBe(destination);
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'business_id',
        before: business,
        after: destination,
      }),
    );
    expect(await operation.executeConfirmed(step, f.context)).toEqual({
      id: '7',
      businessId: destination,
    });
  });
  it('rejects provider transfer that would leave product or invoice references in another business', async () => {
    const f = fixture();
    f.blockTransfer();
    await expect(
      f.op('providers_prepare_update').prepare(
        {
          business_id: business,
          id: '7',
          destination_business_id: destination,
        },
        f.context,
      ),
    ).rejects.toThrow('Provider cannot move');
    expect(f.providerService.update).not.toHaveBeenCalled();
  });
  it('detects newly incompatible references after the provider transfer preview', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared('providers_prepare_update', {
        business_id: business,
        id: '7',
        destination_business_id: destination,
      });
    expect(step.preconditions.transfer_references).toEqual({
      product_count: '0',
      invoice_count: '0',
    });
    f.blockTransfer();
    await expect(operation.executeConfirmed(step, f.context)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
    expect(f.providerService.update).not.toHaveBeenCalled();
  });
  it('rejects empty updates instead of admitting no effects', async () => {
    const f = fixture();
    expect(
      await f
        .op('providers_prepare_update')
        .prepare({ business_id: business, id: '7' }, f.context),
    ).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['changes'],
    });
  });
  it('detects material parent changes even with identical timestamp', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared(
        'provider_contacts_prepare_create',
        { business_id: business, provider_id: '7', name: 'Person' },
      );
    f.provider.name = 'Changed';
    await expect(operation.executeConfirmed(step, f.context)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
    expect(f.contactService.createOnce).not.toHaveBeenCalled();
  });
  it('requires the exact provider and business relationship', async () => {
    const f = fixture();
    await expect(
      f
        .op('provider_contacts_prepare_create')
        .prepare(
          { business_id: destination, provider_id: '7', name: 'Person' },
          f.context,
        ),
    ).rejects.toThrow('Provider not found');
  });
  it('freezes native replacement defaults and version rather than silently preserving omitted fields', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared(
        'provider_contacts_prepare_update',
        { business_id: business, provider_id: '7', id: '8', name: 'Updated' },
      );
    expect(step.commandTemplate.command).toMatchObject({
      name: 'Updated',
      phone: [],
      schedule: {},
      email: null,
      description: null,
      version: 1,
      is_active: true,
    });
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'phone',
        before: {
          kind: 'array',
          items: [
            {
              kind: 'object',
              fields: [{ field_key: 'number', value: '+56987654321' }],
            },
          ],
        },
        after: { kind: 'array', items: [] },
      }),
    );
    await operation.executeConfirmed(step, f.context);
    expect(f.contact).toMatchObject({
      name: 'Updated',
      phone: [],
      schedule: {},
      email: null,
      description: null,
      version: 2,
    });
  });
  it('status changes preserve native contact fields and increment version once', async () => {
    const f = fixture(),
      before = structuredClone(f.contact),
      { operation, step } = await f.prepared(
        'provider_contacts_prepare_set_active',
        { business_id: business, provider_id: '7', id: '8', is_active: false },
      );
    await operation.executeConfirmed(step, f.context);
    expect(f.contact).toMatchObject({
      ...before,
      is_active: false,
      version: 2,
    });
  });
  it('rejects stale contact versions and revocation before calling writers', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared(
        'provider_contacts_prepare_update',
        { business_id: business, provider_id: '7', id: '8', name: 'New' },
      );
    f.contact.version = 2;
    await expect(operation.executeConfirmed(step, f.context)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
    f.revoke();
    await expect(operation.verifyAuthority(step, f.context)).rejects.toThrow(
      'auth:session_expired',
    );
    expect(f.contactService.updateVersion).not.toHaveBeenCalled();
  });
  it('historical authority does not require the target to continue existing', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared(
        'provider_contacts_prepare_update',
        { business_id: business, provider_id: '7', id: '8', name: 'New' },
      );
    f.setMissing();
    f.query.mockClear();
    await operation.verifyAuthority(step, f.context);
    expect(
      f.query.mock.calls.every(
        ([sql]) =>
          !sql.includes('business_id::text,name,tax') &&
          !sql.includes('provider_id::text,name,phone'),
      ),
    ).toBe(true);
  });
  it('rejects malformed phones and schedules using the native rule', async () => {
    const f = fixture();
    for (const patch of [
      { phone: [{ number: '123' }] },
      { schedule: { monday: [{ from: '12:00', to: '09:00' }] } },
      { phone: null },
      { schedule: null },
    ])
      await expect(
        f.op('provider_contacts_prepare_create').prepare(
          {
            business_id: business,
            provider_id: '7',
            name: 'Person',
            ...patch,
          },
          f.context,
        ),
      ).rejects.toThrow('Invalid contact');
  });
  it('reprepares stored edits without changing the intent key and forbids editing it', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared(
        'provider_contacts_prepare_create',
        { business_id: business, provider_id: '7', name: 'Person' },
      );
    const edited = await operation.applyEdits(
      step.commandTemplate,
      [{ step_id: step.id, field_key: 'description', value: null }],
      f.context,
    );
    const next = await operation.reprepareStored(edited, f.context);
    expect(next.status).toBe('ready');
    if (next.status === 'ready')
      expect(
        (next.commandTemplate.command as NodiaAiJsonObject).request_key,
      ).toBe((step.commandTemplate.command as NodiaAiJsonObject).request_key);
    await expect(
      operation.applyEdits(
        step.commandTemplate,
        [{ step_id: step.id, field_key: 'request_key', value: destination }],
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      operation.prepare(step.commandTemplate, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('rejects module-less callers and mismatched historical scope', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared('providers_prepare_update', {
        business_id: business,
        id: '7',
        name: 'Renamed',
      });
    await expect(
      operation.verifyAuthority(
        { ...step, scope: { business_id: destination } },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:capability_denied');
    await expect(
      operation.executeConfirmed(step, { ...f.context, moduleRoutes: [] }),
    ).rejects.toThrow('nodia_ai:capability_denied');
  });
});

describe('Supplier proposal and receipt privacy', () => {
  it.each([
    [
      'providers_prepare_update',
      { business_id: business, id: '7', name: 'New' },
    ],
    [
      'provider_contacts_prepare_update',
      { business_id: business, provider_id: '7', id: '8', name: 'New' },
    ],
  ] as const)(
    'rejects a foreign %s before loading preview fields',
    async (tool, input) => {
      const f = fixture();
      f.hideBusiness(business);
      await expect(f.op(tool).prepare(input, f.context)).rejects.toThrow(
        'business:resource_not_found',
      );
      expect(
        f.query.mock.calls.some(
          ([sql]) =>
            sql.includes('business_id::text,name,tax') ||
            sql.includes('provider_id::text,name,phone'),
        ),
      ).toBe(false);
    },
  );

  it('requires current access to a proposed transfer destination before showing its preview', async () => {
    const f = fixture();
    f.hideBusiness(destination);
    await expect(
      f
        .op('providers_prepare_update')
        .prepare(
          {
            business_id: business,
            id: '7',
            destination_business_id: destination,
          },
          f.context,
        ),
    ).rejects.toThrow('business:resource_not_found');
    expect(f.providerService.update).not.toHaveBeenCalled();
  });

  it('denies a stored receipt when the actor loses business membership', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared('providers_prepare_update', {
        business_id: business,
        id: '7',
        name: 'New',
      });
    f.hideBusiness(business);
    await expect(operation.verifyAuthority(step, f.context)).rejects.toThrow(
      'business:resource_not_found',
    );
  });

  it('checks the current supplier parent rather than trusting the stored scope', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared('providers_prepare_update', {
        business_id: business,
        id: '7',
        name: 'New',
      });
    f.provider.business_id = '33333333-3333-4333-8333-333333333333';
    f.query.mockClear();
    await expect(operation.verifyAuthority(step, f.context)).rejects.toThrow(
      'business:resource_not_found',
    );
    expect(
      f.query.mock.calls.some(([sql]) =>
        sql.includes('business_id::text,name,tax'),
      ),
    ).toBe(false);
  });

  it('denies a contact moved under a provider outside the authorized business', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared(
        'provider_contacts_prepare_update',
        { business_id: business, provider_id: '7', id: '8', name: 'New' },
      );
    f.contact.provider_id = '99';
    await expect(operation.verifyAuthority(step, f.context)).rejects.toThrow(
      'business:resource_not_found',
    );
  });

  it('allows historical recovery after authorized data changes without requiring old preconditions', async () => {
    const f = fixture(),
      { operation, step } = await f.prepared('providers_prepare_update', {
        business_id: business,
        id: '7',
        name: 'New',
      });
    f.provider.name = 'Changed since the receipt';
    f.provider.updated_at = '2026-10-25T12:00:00.000Z';
    await expect(
      operation.verifyAuthority(step, f.context),
    ).resolves.toBeUndefined();
    await expect(
      operation.verifyPreconditions(step, f.context),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
  });

  it('uses the current database superadministrator privilege rather than a cached actor flag', async () => {
    const f = fixture();
    f.hideBusiness(business);
    f.setSuperAdmin();
    const { operation, step } = await f.prepared('providers_prepare_update', {
      business_id: business,
      id: '7',
      name: 'New',
    });
    await expect(
      operation.verifyAuthority(step, f.context),
    ).resolves.toBeUndefined();
    f.setSuperAdmin(false);
    f.context.actor.isSuperAdmin = true;
    await expect(operation.verifyAuthority(step, f.context)).rejects.toThrow(
      'business:resource_not_found',
    );
  });
});
