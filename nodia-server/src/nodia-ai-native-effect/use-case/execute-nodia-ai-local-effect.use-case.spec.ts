import type { NodiaAiProviderOperation } from '../../nodia-ai-provider-operations/types/provider-operation.types.js';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { ExecuteNodiaAiFinanceEffectUseCase } from '../../nodia-ai-finance-effect/use-case/execute-nodia-ai-finance-effect.use-case.js';
import type { ExecuteNodiaAiFinanceMovementEffectUseCase } from '../../nodia-ai-finance-effect/use-case/execute-nodia-ai-finance-movement-effect.use-case.js';
import type { NodiaAiFinanceOperation } from '../../nodia-ai-finance-effect/types/financial-operation.types.js';
import type { NodiaAiNativeOperation } from '../../nodia-ai-proposal/types/native-operation.types.js';
import type { NodiaAiRentalConfigurationOperation } from '../../nodia-ai-rental-configuration/types/rental-configuration-operation.types.js';
import type { NodiaAiRentalReservationOperation } from '../../nodia-ai-rental-reservation/types/rental-reservation-operation.types.js';
import type { NodiaAiRentalMoneyOperation } from '../../nodia-ai-rental-money/types/rental-money-operation.types.js';
import type { NodiaAiRentalOperation } from '../../nodia-ai-rental-operations/types/rental-operation.types.js';
import type { NodiaAiCoreOperation } from '../../nodia-ai-core-operations/types/core-operation.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { ExecuteNodiaAiLocalEffectUseCase } from './execute-nodia-ai-local-effect.use-case.js';

const business = '11111111-1111-4111-8111-111111111111';
const targetBusiness = '22222222-2222-4222-8222-222222222222';
const contract = 'a'.repeat(64);
function step(toolName = 'nodia_invoices_prepare_update'): StoredProposalStep {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    position: 0,
    toolName,
    contractHash: contract,
    commandTemplate: {
      schema_version: 1,
      business_id: business,
      id: '7',
      command: { code: 'new' },
      origins: { code: 'user' },
    },
    scope: { business_id: business },
    preconditions: { destination_business_id: targetBusiness },
    publicStep: { depends_on: [] },
    outputBindings: [],
  };
}
function fixture() {
  const context: ProposalPreparerContext = {
    manager: { queryRunner: { isTransactionActive: true } } as EntityManager,
    actor: {
      actorId: '1',
      sessionId: '44444444-4444-4444-8444-444444444444',
      isSuperAdmin: false,
      modules: [{ id: '2', key: 'business', route: '/business' }],
    },
    moduleRoutes: ['/business'],
    conversationId: '55555555-5555-4555-8555-555555555555',
  };
  const executeBusiness = vi.fn(
    async (_step: StoredProposalStep, _context: ProposalPreparerContext) => ({
      id: '7',
      businessId: targetBusiness,
    }),
  );
  const businessPort: NodiaAiNativeOperation = {
    toolName: 'nodia_invoices_prepare_update',
    contractHash: contract,
    resourceKey: 'invoices',
    operation: 'update',
    catalogVersion: 'nodia-ai-ai22-business/1',
    moduleRoutes: ['/business'],
    actionKeys: [],
    editableFields: { code: 'string' },
    bindableFields: {},
    outputKeys: { id: 'invoice_id' },
    prepare: vi.fn(),
    reprepareStored: vi.fn(),
    applyEdits: vi.fn(),
    verifyAuthority: vi.fn(),
    verifyPreconditions: vi.fn(),
    executeConfirmed: executeBusiness,
  };
  const executeLegacy = vi.fn(
    async (_step: StoredProposalStep, _context: ProposalPreparerContext) => ({
      id: '8',
      ownerId: '1',
    }),
  );
  const executeFinancialUpdate = vi.fn(
    async (_step: StoredProposalStep, _context: ProposalPreparerContext) => ({
      id: '9',
      ownerId: '1',
    }),
  );
  const financialPort: NodiaAiFinanceOperation = {
    ...businessPort,
    toolName: 'nodia_finance_movements_prepare_update',
    resourceKey: 'finance_movements',
    operation: 'update',
    moduleRoutes: ['/finances-personal'],
    executeConfirmed: executeFinancialUpdate,
  };
  const finance = new ExecuteNodiaAiFinanceEffectUseCase(
    {
      execute: executeLegacy,
    } as unknown as ExecuteNodiaAiFinanceMovementEffectUseCase,
    [financialPort],
  );
  const local = new ExecuteNodiaAiLocalEffectUseCase(finance, [businessPort]);
  return {
    context,
    businessPort,
    finance,
    local,
    executeBusiness,
    executeLegacy,
    executeFinancialUpdate,
  };
}

describe('ExecuteNodiaAiLocalEffectUseCase', () => {
  it.each([
    ['rental_payments', 'create'],
    ['rental_payments', 'void'],
    ['rental_expenses', 'create'],
    ['rental_expenses', 'update'],
    ['rental_expenses', 'pay'],
    ['rental_expenses', 'void'],
    ['rental_blocks', 'create'],
    ['rental_blocks', 'update'],
    ['rental_turnovers', 'update'],
    ['rental_turnovers', 'approve_same_day'],
  ] as const)(
    'dispatches the exact AI26 %s/%s port without falling back',
    async (resource, operation) => {
      const f = fixture();
      const execute = vi.fn(async () => ({
        id: '9007199254740993',
        propertyId: '7',
      }));
      const port = {
        ...f.businessPort,
        toolName: `nodia_${resource}_prepare_${operation}`,
        resourceKey: resource,
        operation,
        moduleRoutes: ['/reservations'],
        executeConfirmed: execute,
      } as unknown as NodiaAiRentalMoneyOperation | NodiaAiRentalOperation;
      const monetary =
        resource === 'rental_payments' || resource === 'rental_expenses';
      const local = new ExecuteNodiaAiLocalEffectUseCase(
        f.finance,
        [],
        [],
        [],
        monetary ? [port as NodiaAiRentalMoneyOperation] : [],
        monetary ? [] : [port as NodiaAiRentalOperation],
      );
      const source = step(port.toolName);
      await expect(local.execute(source, f.context)).resolves.toEqual({
        id: '9007199254740993',
        propertyId: '7',
      });
      expect(execute).toHaveBeenCalledExactlyOnceWith(source, f.context);
      expect(() =>
        local.execute({ ...source, contractHash: 'b'.repeat(64) }, f.context),
      ).toThrow('catalog_changed');
      expect(execute).toHaveBeenCalledTimes(1);
      expect(f.executeBusiness).not.toHaveBeenCalled();
      expect(f.executeLegacy).not.toHaveBeenCalled();
    },
  );
  it.each([
    ['rental_payments', 'update'],
    ['rental_expenses', 'delete'],
    ['rental_blocks', 'void'],
    ['rental_turnovers', 'create'],
    ['rental_turnovers', 'pay'],
  ])(
    'rejects invented AI26 operations %s/%s before dispatch',
    (resource, operation) => {
      const f = fixture();
      const port = {
        ...f.businessPort,
        toolName: `nodia_${resource}_prepare_${operation}`,
        resourceKey: resource,
        operation,
      } as unknown as NodiaAiRentalMoneyOperation;
      expect(
        () =>
          new ExecuteNodiaAiLocalEffectUseCase(f.finance, [], [], [], [port]),
      ).toThrow('invalid_native_operation');
    },
  );
  it.each([
    'create',
    'update',
    'confirm',
    'start',
    'complete',
    'cancel',
  ] as const)(
    'dispatches reservation %s only through its exact registered contract',
    async (operation) => {
      const f = fixture();
      const execute = vi.fn(async () => ({
        id: '9007199254740993',
        propertyId: '7',
      }));
      const port: NodiaAiRentalReservationOperation = {
        ...f.businessPort,
        toolName: `nodia_rental_reservations_prepare_${operation}`,
        resourceKey: 'rental_reservations',
        operation,
        catalogVersion: 'nodia-ai-ai25-rental-reservation/1',
        moduleRoutes: ['/reservations'],
        executeConfirmed: execute,
      };
      const local = new ExecuteNodiaAiLocalEffectUseCase(
        f.finance,
        [],
        [],
        [port],
      );
      const source = step(port.toolName);
      await expect(local.execute(source, f.context)).resolves.toEqual({
        id: '9007199254740993',
        propertyId: '7',
      });
      expect(execute).toHaveBeenCalledExactlyOnceWith(source, f.context);
      expect(() =>
        local.execute({ ...source, contractHash: 'b'.repeat(64) }, f.context),
      ).toThrow('catalog_changed');
      expect(execute).toHaveBeenCalledTimes(1);
      expect(f.executeBusiness).not.toHaveBeenCalled();
      expect(f.executeLegacy).not.toHaveBeenCalled();
    },
  );
  it.each([
    { toolName: 'nodia_rental_reservations_prepare_delete' },
    { resourceKey: 'rental_properties' },
    { operation: 'update' },
  ])('rejects incompatible reservation executor metadata: %j', (metadata) => {
    const f = fixture();
    const port = {
      ...f.businessPort,
      toolName: 'nodia_rental_reservations_prepare_confirm',
      resourceKey: 'rental_reservations',
      operation: 'confirm',
      ...metadata,
    } as unknown as NodiaAiRentalReservationOperation;
    expect(
      () => new ExecuteNodiaAiLocalEffectUseCase(f.finance, [], [], [port]),
    ).toThrow('invalid_native_operation');
  });
  it('rejects duplicate reservation executors before dispatch', () => {
    const f = fixture();
    const port = {
      ...f.businessPort,
      toolName: 'nodia_rental_reservations_prepare_cancel',
      resourceKey: 'rental_reservations',
      operation: 'cancel',
    } as unknown as NodiaAiRentalReservationOperation;
    expect(
      () =>
        new ExecuteNodiaAiLocalEffectUseCase(f.finance, [], [], [port, port]),
    ).toThrow('invalid_native_operation');
  });
  it('routes a rental revision only to its registered native port and rejects changed contracts', async () => {
    const f = fixture();
    const execute = vi.fn(async () => ({ id: '12', propertyId: '7' }));
    const rental: NodiaAiRentalConfigurationOperation = {
      ...f.businessPort,
      toolName: 'nodia_rental_cancellation_policies_prepare_update',
      resourceKey: 'rental_cancellation_policies',
      operation: 'update',
      catalogVersion: 'nodia-ai-ai24-rental-configuration/1',
      moduleRoutes: ['/reservations'],
      executeConfirmed: execute,
    };
    const local = new ExecuteNodiaAiLocalEffectUseCase(
      f.finance,
      [f.businessPort],
      [rental],
    );
    const source = step(rental.toolName);
    await expect(local.execute(source, f.context)).resolves.toEqual({
      id: '12',
      propertyId: '7',
    });
    expect(execute).toHaveBeenCalledExactlyOnceWith(source, f.context);
    expect(() =>
      local.execute({ ...source, contractHash: 'b'.repeat(64) }, f.context),
    ).toThrow('catalog_changed');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(f.executeBusiness).not.toHaveBeenCalled();
    expect(f.executeLegacy).not.toHaveBeenCalled();
  });
  it.each([
    {
      toolName: 'nodia_rental_properties_prepare_delete',
      resourceKey: 'rental_properties',
      operation: 'update',
    },
    {
      toolName: 'nodia_rental_properties_prepare_update',
      resourceKey: 'rental_collaborators',
      operation: 'update',
    },
    {
      toolName: 'nodia_rental_properties_prepare_update',
      resourceKey: 'rental_properties',
      operation: 'create',
    },
  ])(
    'rejects a mismatched rental registration before execution: %j',
    (metadata) => {
      const f = fixture();
      const rental = {
        ...f.businessPort,
        ...metadata,
      } as unknown as NodiaAiRentalConfigurationOperation;
      expect(
        () => new ExecuteNodiaAiLocalEffectUseCase(f.finance, [], [rental]),
      ).toThrow('invalid_native_operation');
    },
  );
  it('dispatches the exact business revision and actor transaction without changing source or destination scope', async () => {
    const f = fixture();
    const source = step();
    const frozen = structuredClone(source);
    await expect(f.local.execute(source, f.context)).resolves.toEqual({
      id: '7',
      businessId: targetBusiness,
    });
    const [actualStep, actualContext] = f.executeBusiness.mock.calls[0];
    expect(actualStep).toBe(source);
    expect(actualContext).toBe(f.context);
    expect(source).toEqual(frozen);
    expect(f.businessPort.prepare).not.toHaveBeenCalled();
    expect(f.businessPort.reprepareStored).not.toHaveBeenCalled();
    expect(f.executeLegacy).not.toHaveBeenCalled();
    expect(f.executeFinancialUpdate).not.toHaveBeenCalled();
  });

  it.each([
    'nodia_invoices_prepare_delete',
    'InvoiceService.updateInvoice',
    '__proto__',
    'constructor',
    'nodia_invoices_prepare_update ',
  ])(
    'rejects the unregistered or inherited operation %s without dispatching any effect',
    (name) => {
      const f = fixture();
      expect(() => f.local.execute(step(name), f.context)).toThrow(
        'catalog_changed',
      );
      expect(f.executeBusiness).not.toHaveBeenCalled();
      expect(f.executeLegacy).not.toHaveBeenCalled();
      expect(f.executeFinancialUpdate).not.toHaveBeenCalled();
    },
  );

  it('rejects a changed business contract before touching the native writer', () => {
    const f = fixture();
    expect(() =>
      f.local.execute({ ...step(), contractHash: 'b'.repeat(64) }, f.context),
    ).toThrow('catalog_changed');
    expect(f.executeBusiness).not.toHaveBeenCalled();
  });

  it.each([
    { toolName: 'nodia_invoices_prepare_delete' },
    { resourceKey: 'providers' },
    { operation: 'create' },
    {
      toolName: 'nodia_finance_movements_prepare_create',
      resourceKey: 'finance_movements',
    },
  ])(
    'rejects a code registration whose name and metadata disagree: %j',
    (metadata) => {
      const f = fixture();
      const corrupted = {
        ...f.businessPort,
        ...metadata,
      } as unknown as NodiaAiNativeOperation;
      expect(
        () => new ExecuteNodiaAiLocalEffectUseCase(f.finance, [corrupted]),
      ).toThrow('invalid_native_operation');
      expect(f.executeBusiness).not.toHaveBeenCalled();
      expect(f.executeLegacy).not.toHaveBeenCalled();
    },
  );

  it('rejects duplicate registrations instead of resolving the collision by array order', () => {
    const f = fixture();
    const duplicate = { ...f.businessPort, contractHash: 'c'.repeat(64) };
    expect(
      () =>
        new ExecuteNodiaAiLocalEffectUseCase(f.finance, [
          f.businessPort,
          duplicate,
        ]),
    ).toThrow('invalid_native_operation');
  });

  it('preserves the legacy financial path, including its original object and native result', async () => {
    const f = fixture();
    const original = step('nodia_finance_movements_prepare_create');
    await expect(f.local.execute(original, f.context)).resolves.toEqual({
      id: '8',
      ownerId: '1',
    });
    expect(f.executeLegacy.mock.calls[0][0]).toBe(original);
    expect(f.executeLegacy.mock.calls[0][1]).toBe(f.context);
    expect(f.executeBusiness).not.toHaveBeenCalled();
    expect(f.executeFinancialUpdate).not.toHaveBeenCalled();
  });

  it('preserves the financial registry contract check rather than bypassing it through the local dispatcher', async () => {
    const f = fixture();
    const original = step('nodia_finance_movements_prepare_update');
    await expect(f.local.execute(original, f.context)).resolves.toEqual({
      id: '9',
      ownerId: '1',
    });
    await expect(
      f.local.execute({ ...original, contractHash: 'b'.repeat(64) }, f.context),
    ).rejects.toThrow('catalog_changed');
    expect(f.executeFinancialUpdate).toHaveBeenCalledTimes(1);
    expect(f.executeBusiness).not.toHaveBeenCalled();
  });

  it('propagates a domain rejection without retrying, preparing again or falling back to finance', async () => {
    const f = fixture();
    const failure = new Error('nodia_ai:preconditions_changed');
    f.executeBusiness.mockRejectedValueOnce(failure);
    await expect(f.local.execute(step(), f.context)).rejects.toBe(failure);
    expect(f.executeBusiness).toHaveBeenCalledTimes(1);
    expect(f.executeLegacy).not.toHaveBeenCalled();
    expect(f.executeFinancialUpdate).not.toHaveBeenCalled();
    expect(f.businessPort.prepare).not.toHaveBeenCalled();
  });
});

describe('Core exact executor dispatch', () => {
  const cases = (
    [
      'users',
      'roles',
      'actions',
      'business_actions',
      'modules',
      'module_groups',
    ] as const
  ).flatMap((resource) =>
    (resource === 'users'
      ? (['create', 'update'] as const)
      : (['create', 'update', 'delete'] as const)
    ).map((operation) => ({ resource, operation })),
  );
  it.each(cases)(
    'dispatches only the registered $resource/$operation contract',
    async ({ resource, operation }) => {
      const f = fixture(),
        execute = vi.fn(async () => ({ id: '9007199254740993' }));
      const port = {
        ...f.businessPort,
        toolName: `nodia_${resource}_prepare_${operation}`,
        resourceKey: resource,
        operation,
        executeConfirmed: execute,
      } as unknown as NodiaAiCoreOperation;
      const local = new ExecuteNodiaAiLocalEffectUseCase(
        f.finance,
        [],
        [],
        [],
        [],
        [],
        [port],
      );
      const source = step(port.toolName);
      await expect(local.execute(source, f.context)).resolves.toEqual({
        id: '9007199254740993',
      });
      expect(execute).toHaveBeenCalledExactlyOnceWith(source, f.context);
      expect(() =>
        local.execute({ ...source, contractHash: 'b'.repeat(64) }, f.context),
      ).toThrow('catalog_changed');
      expect(execute).toHaveBeenCalledTimes(1);
      expect(f.executeBusiness).not.toHaveBeenCalled();
    },
  );
  it.each([
    'nodia_users_prepare_delete',
    'nodia_roles_prepare_set_active',
    'nodia_modules_prepare_patch',
  ])('rejects invented Core action %s', (toolName) => {
    const f = fixture(),
      port = {
        ...f.businessPort,
        toolName,
        resourceKey: 'users',
        operation: 'update',
      } as unknown as NodiaAiCoreOperation;
    expect(
      () =>
        new ExecuteNodiaAiLocalEffectUseCase(
          f.finance,
          [],
          [],
          [],
          [],
          [],
          [port],
        ),
    ).toThrow('invalid_native_operation');
  });
});

describe('Non-secret provider exact dispatch', () => {
  const cases = [false, true].flatMap((catalog) =>
    (['create', 'update'] as const).map((operation) => ({
      catalog,
      operation,
    })),
  );
  it.each(cases)(
    'dispatches only catalog=$catalog/$operation and preserves the transaction context',
    async ({ catalog, operation }) => {
      const f = fixture(),
        execute = vi.fn(async () => ({ id: '9007199254740993' }));
      const port = {
        ...f.businessPort,
        toolName: `nodia_ai_providers_prepare_${catalog ? 'catalog_' : ''}${operation}`,
        resourceKey: catalog ? 'ai_provider_catalog' : 'ai_providers',
        operation,
        executeConfirmed: execute,
      } as unknown as NodiaAiProviderOperation;
      const local = new ExecuteNodiaAiLocalEffectUseCase(
        f.finance,
        [],
        [],
        [],
        [],
        [],
        [],
        undefined,
        [port],
      );
      const source = step(port.toolName);
      await expect(local.execute(source, f.context)).resolves.toEqual({
        id: '9007199254740993',
      });
      expect(execute).toHaveBeenCalledExactlyOnceWith(source, f.context);
      expect(() =>
        local.execute({ ...source, contractHash: 'b'.repeat(64) }, f.context),
      ).toThrow('catalog_changed');
      expect(f.executeLegacy).not.toHaveBeenCalled();
      expect(f.executeBusiness).not.toHaveBeenCalled();
    },
  );
  it.each([
    'nodia_ai_providers_prepare_delete',
    'nodia_ai_providers_prepare_sync_models',
    'nodia_ai_providers_prepare_codex_logout',
    'nodia_ai_providers_prepare_gemini_web_logout',
  ])(
    'does not execute unregistered local/external provider operation %s',
    (name) => {
      const f = fixture();
      expect(() => f.local.execute(step(name), f.context)).toThrow(
        'catalog_changed',
      );
      expect(f.executeLegacy).not.toHaveBeenCalled();
      expect(f.executeBusiness).not.toHaveBeenCalled();
    },
  );
  it('rejects a provider registration with mismatched identity and duplicate registrations', () => {
    const f = fixture();
    const port = {
      ...f.businessPort,
      toolName: 'nodia_ai_providers_prepare_update',
      resourceKey: 'ai_providers',
      operation: 'update',
    } as unknown as NodiaAiProviderOperation;
    expect(
      () =>
        new ExecuteNodiaAiLocalEffectUseCase(
          f.finance,
          [],
          [],
          [],
          [],
          [],
          [],
          undefined,
          [{ ...port, resourceKey: 'ai_provider_catalog' }],
        ),
    ).toThrow('invalid_native_operation');
    expect(
      () =>
        new ExecuteNodiaAiLocalEffectUseCase(
          f.finance,
          [],
          [],
          [],
          [],
          [],
          [],
          undefined,
          [port, port],
        ),
    ).toThrow('invalid_native_operation');
  });
});
