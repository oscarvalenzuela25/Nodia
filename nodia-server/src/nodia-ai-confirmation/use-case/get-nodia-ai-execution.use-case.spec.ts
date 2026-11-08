import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import { NodiaAiExecutionStep } from '../entities/nodia-ai-execution-step.entity.js';
import { nodiaAiBoundExecutionBinding } from '../../nodia-ai-execution/types/bound-execution-step.js';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import type { NodiaAiConfirmationService } from '../nodia-ai-confirmation.service.js';
import { GetNodiaAiExecutionUseCase } from './get-nodia-ai-execution.use-case.js';
import { confirmationFixture } from './confirmation.fixture.js';
import { nodiaAiFinancialBinding } from '../../nodia-ai-finance-effect/types/financial-operation.types.js';
function fixture() {
  const f = confirmationFixture();
  return {
    ...f,
    useCase: new GetNodiaAiExecutionUseCase(
      f.store as unknown as NodiaAiConfirmationService,
      f.get as unknown as GetNodiaAiProposalUseCase,
      f.validate,
      f.policy,
      f.availability,
    ),
  };
}
describe('NodiaAI authorized operation recovery', () => {
  const secureCases = [
    ['nodia_secure_flows_prepare_api_key_create', 'api_key_create'],
    ['nodia_secure_flows_prepare_api_key_update', 'api_key_update'],
    ['nodia_api_keys_prepare_delete', 'api_key_delete'],
    ['nodia_secure_flows_prepare_connection_login', 'connection_login'],
    ['nodia_secure_flows_prepare_nodia_logout', 'nodia_logout'],
    ['nodia_ai_providers_prepare_codex_logout', 'codex_logout'],
    ['nodia_ai_providers_prepare_gemini_web_logout', 'gemini_web_logout'],
    ['nodia_ai_providers_prepare_sync_models', 'sync_models'],
  ];
  async function secureReceipt(tool: string, kind: string) {
    const f = await coreReceipt('secure_flows', kind),
      reference = randomUUID();
    f.step.tool_name = tool;
    f.executionStep.tool_name = tool;
    f.execution.minimal_scope.steps[0].tool_name = tool;
    f.executionStep.template_hash = f.validate.hash({
      command_template: f.step.command_template,
      output_bindings: f.step.output_bindings,
      preconditions: f.step.preconditions,
    });
    f.executionStep.bound_command_hash = f.validate.hash(
      nodiaAiBoundExecutionBinding(f.step, false),
    );
    f.executionStep.minimal_receipt = {
      schema_version: 1,
      resource_key: 'secure_flows',
      id: reference,
      operation: kind,
    };
    f.executionStep.recovery_descriptor = {
      schema_version: 1,
      kind: 'secure_human_flow',
      reference,
      flow_kind: kind,
      actor_id: f.execution.actor_id,
      session_id: f.identity.sessionId,
      expires_at: new Date(f.now.getTime() + 300000).toISOString(),
      status: 'completed',
      native_reference: null,
      request_id: randomUUID(),
      request_action: kind.startsWith('api_key') ? 'key' : 'start',
      request_revision: 3,
    };
    return { ...f, reference };
  }
  it.each(secureCases)(
    'projects a minimal historical secure receipt for %s',
    async (tool, kind) => {
      const f = await secureReceipt(tool, kind);
      const result = await f.useCase.execute(f.identity, f.execution.id);
      expect(result.steps[0].result_refs).toEqual([
        { resource_key: 'secure_flows', id: f.reference },
      ]);
      expect(JSON.stringify(result)).not.toContain(f.identity.sessionId);
      expect(f.preparer.prepare).not.toHaveBeenCalled();
    },
  );
  it.each(['actor', 'receipt_id', 'kind', 'status', 'extra'])(
    'rejects corrupt secure witness %s',
    async (variant) => {
      const f = await secureReceipt(secureCases[0][0], secureCases[0][1]);
      if (variant === 'actor')
        f.executionStep.recovery_descriptor!.actor_id = '999';
      if (variant === 'receipt_id')
        f.executionStep.minimal_receipt!.id = randomUUID();
      if (variant === 'kind')
        f.executionStep.minimal_receipt!.operation = 'api_key_update';
      if (variant === 'status')
        f.executionStep.recovery_descriptor!.status = 'unknown';
      if (variant === 'extra')
        f.executionStep.minimal_receipt!.secret = 'synthetic-forbidden';
      await expect(
        f.useCase.execute(f.identity, f.execution.id),
      ).rejects.toThrow('nodia_ai:invalid_persisted_state');
    },
  );
  async function completed() {
    const f = fixture();
    const [step] = await f.store.steps();
    f.step.tool_name = 'nodia_finance_movements_prepare_create';
    f.step.scope = { subject_user_id: '1' };
    f.step.command_template = {
      owner_id: '1',
      command: { amount: '9007199254740993' },
    };
    step.tool_name = f.step.tool_name;
    step.minimal_scope = f.step.scope;
    step.template_hash = f.validate.hash({
      command_template: f.step.command_template,
      output_bindings: f.step.output_bindings,
      preconditions: f.step.preconditions,
    });
    step.bound_command_hash = f.validate.hash({
      tool_name: f.step.tool_name,
      contract_hash: f.step.contract_hash,
      scope: f.step.scope,
      owner_id: '1',
      command: f.step.command_template.command,
    });
    step.state = 'completed';
    step.completed_at = f.now;
    step.dispatched_at = f.now;
    step.minimal_receipt = {
      schema_version: 1,
      resource_key: 'finance_movements',
      resource_id: '9007199254740993',
      subject_user_id: '1',
    };
    f.execution.state = 'completed';
    f.execution.completed_at = f.now;
    f.execution.minimal_scope = {
      schema_version: 1,
      steps: [
        {
          step_id: f.step.id,
          tool_name: f.step.tool_name,
          contract_hash: f.step.contract_hash,
          scope: f.step.scope,
        },
      ],
    };
    return { ...f, executionStep: step };
  }
  it('projects a verified receipt as a durable native reference without reading or recreating the movement', async () => {
    const f = await completed();
    const result = await f.useCase.execute(f.identity, f.execution.id);
    expect(result.steps[0].result_refs).toEqual([
      { resource_key: 'finance_movements', id: '9007199254740993' },
    ]);
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.preparer.prepare).not.toHaveBeenCalled();
  });
  it('retains verified historical receipts after authorized incompatible reads and never enables resume', async () => {
    const f = await completed();
    const loaded = await f.get.load();
    loaded.catalogCompatible = false;
    const original = JSON.stringify([f.execution, f.executionStep]);
    const result = await f.useCase.execute(f.identity, f.execution.id);
    expect(result.can_resume).toBe(false);
    expect(result.steps[0].result_refs).toEqual([
      { resource_key: 'finance_movements', id: '9007199254740993' },
    ]);
    expect(JSON.stringify([f.execution, f.executionStep])).toBe(original);
    expect(f.store.create).not.toHaveBeenCalled();
    f.executionStep.minimal_receipt!.subject_user_id = '2';
    await expect(f.useCase.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
  });
  async function financialReceipt(resource: string, operation: string) {
    const f = await completed();
    f.step.tool_name = `nodia_${resource}_prepare_${operation}`;
    f.step.command_template.id = '9007199254740993';
    f.executionStep.tool_name = f.step.tool_name;
    f.executionStep.template_hash = f.validate.hash({
      command_template: f.step.command_template,
      output_bindings: f.step.output_bindings,
      preconditions: f.step.preconditions,
    });
    f.executionStep.bound_command_hash = f.validate.hash(
      nodiaAiFinancialBinding(f.step),
    );
    f.executionStep.minimal_receipt = {
      schema_version: 1,
      resource_key: resource,
      operation,
      resource_id: '9007199254740993',
      subject_user_id: '1',
    };
    f.execution.minimal_scope.steps[0].tool_name = f.step.tool_name;
    return f;
  }
  async function coreReceipt(resource: string, operation: string) {
    const f = await completed();
    f.step.tool_name = `nodia_${resource}_prepare_${operation}`;
    f.step.scope = {};
    f.step.preconditions = {
      target: operation === 'create' ? null : { id: '9007199254740993' },
    };
    f.step.command_template = {
      schema_version: 1,
      ...(operation === 'create' ? {} : { id: '9007199254740993' }),
      command: {},
      origins: {},
    };
    f.executionStep.tool_name = f.step.tool_name;
    f.executionStep.minimal_scope = {};
    f.executionStep.template_hash = f.validate.hash({
      command_template: f.step.command_template,
      output_bindings: f.step.output_bindings,
      preconditions: f.step.preconditions,
    });
    f.executionStep.bound_command_hash = f.validate.hash(
      nodiaAiBoundExecutionBinding(f.step),
    );
    f.executionStep.minimal_receipt = {
      schema_version: 1,
      resource_key: resource,
      operation,
      resource_id: '9007199254740993',
    };
    f.execution.minimal_scope.steps[0].tool_name = f.step.tool_name;
    f.execution.minimal_scope.steps[0].scope = {};
    return f;
  }
  it.each(
    (
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
        ? ['create', 'update']
        : ['create', 'update', 'delete']
      ).map((operation) => ({ resource, operation })),
    ),
  )(
    'projects historical Core $resource/$operation without requiring the current record',
    async ({ resource, operation }) => {
      const f = await coreReceipt(resource, operation);
      const result = await f.useCase.execute(f.identity, f.execution.id);
      expect(result.steps[0].result_refs).toEqual([
        { resource_key: resource, id: '9007199254740993' },
      ]);
      expect(f.preparer.prepare).not.toHaveBeenCalled();
      expect(f.store.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    { resource_id: '7' },
    { resource_id: Number.MAX_SAFE_INTEGER + 1 },
    { resource_key: 'users' },
    { operation: 'create' },
    { subject_user_id: '1' },
    { command: { roles: [] } },
  ])('rejects a corrupt Core receipt %j', async (delta) => {
    const f = await coreReceipt('roles', 'delete');
    Object.assign(f.executionStep.minimal_receipt!, delta);
    await expect(f.useCase.execute(f.identity, f.execution.id)).rejects.toThrow(
      'invalid_persisted_state',
    );
  });
  it('does not relabel an existing upsert result as another resource', async () => {
    const f = await coreReceipt('users', 'create');
    f.step.preconditions = { target: { id: '7' } };
    f.executionStep.template_hash = f.validate.hash({
      command_template: f.step.command_template,
      output_bindings: f.step.output_bindings,
      preconditions: f.step.preconditions,
    });
    f.executionStep.bound_command_hash = f.validate.hash(
      nodiaAiBoundExecutionBinding(f.step),
    );
    await expect(f.useCase.execute(f.identity, f.execution.id)).rejects.toThrow(
      'invalid_persisted_state',
    );
  });
  async function aiProviderReceipt(catalog: boolean, operation: string) {
    const resource = catalog ? 'ai_provider_catalog' : 'ai_providers';
    const f = await coreReceipt(resource, operation);
    f.step.tool_name = `nodia_ai_providers_prepare_${catalog ? 'catalog_' : ''}${operation}`;
    f.executionStep.tool_name = f.step.tool_name;
    f.executionStep.bound_command_hash = f.validate.hash(
      nodiaAiBoundExecutionBinding(f.step),
    );
    f.execution.minimal_scope.steps[0].tool_name = f.step.tool_name;
    return f;
  }
  it.each(
    [false, true].flatMap((catalog) =>
      ['create', 'update'].map((operation) => ({ catalog, operation })),
    ),
  )(
    'projects historical non-secret provider receipt catalog=$catalog/$operation without re-reading provider configuration',
    async ({ catalog, operation }) => {
      const f = await aiProviderReceipt(catalog, operation);
      const result = await f.useCase.execute(f.identity, f.execution.id);
      expect(result.steps[0].result_refs).toEqual([
        {
          resource_key: catalog ? 'ai_provider_catalog' : 'ai_providers',
          id: '9007199254740993',
        },
      ]);
      expect(f.preparer.prepare).not.toHaveBeenCalled();
      expect(f.store.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    { resource_id: '7' },
    { resource_id: Number.MAX_SAFE_INTEGER + 1 },
    { resource_key: 'ai_provider_catalog' },
    { operation: 'delete' },
    { api_key: 'synthetic-forbidden' },
    { command: { is_default: true } },
    { fields: { selected_model: 'synthetic-forbidden' } },
  ])(
    'rejects corrupt or excessive non-secret provider receipt %j',
    async (delta) => {
      const f = await aiProviderReceipt(false, 'update');
      Object.assign(f.executionStep.minimal_receipt!, delta);
      await expect(
        f.useCase.execute(f.identity, f.execution.id),
      ).rejects.toThrow('invalid_persisted_state');
    },
  );
  async function businessReceipt(
    resource: string,
    operation: string,
    id: string,
  ) {
    const f = await completed();
    const business = '11111111-1111-4111-8111-111111111111';
    f.step.tool_name = `nodia_${resource}_prepare_${operation}`;
    f.step.scope =
      resource === 'businesses' && operation === 'create'
        ? {}
        : { business_id: business };
    f.step.command_template = {
      schema_version: 1,
      ...(resource === 'businesses' && operation === 'create'
        ? {}
        : { business_id: business }),
      ...(operation === 'create' ? {} : { id }),
      command: {},
      origins: {},
    };
    f.step.preconditions = { destination_business_id: business };
    f.executionStep.tool_name = f.step.tool_name;
    f.executionStep.minimal_scope = f.step.scope;
    f.executionStep.template_hash = f.validate.hash({
      command_template: f.step.command_template,
      output_bindings: f.step.output_bindings,
      preconditions: f.step.preconditions,
    });
    f.executionStep.bound_command_hash = f.validate.hash(
      nodiaAiFinancialBinding(f.step),
    );
    f.executionStep.minimal_receipt = {
      schema_version: 1,
      resource_key: resource,
      operation,
      resource_id: id,
      business_id:
        resource === 'businesses' && operation === 'create' ? id : business,
    };
    f.execution.minimal_scope.steps[0].tool_name = f.step.tool_name;
    f.execution.minimal_scope.steps[0].scope = f.step.scope;
    return f;
  }
  async function rentalReceipt(resource: string, operation: string) {
    const f = await completed();
    const id = '9007199254740993';
    const property = resource === 'rental_properties' ? id : '7';
    const creation = resource === 'rental_properties' && operation === 'create';
    f.step.tool_name = `nodia_${resource}_prepare_${operation}`;
    f.step.scope = creation
      ? { subject_user_id: '1' }
      : { property_id: property };
    f.step.command_template = {
      schema_version: 1,
      ...(creation ? {} : { property_id: property }),
      ...(operation !== 'create' ? { id } : {}),
      command: creation ? { owner_id: '1' } : {},
      origins: creation ? { owner_id: 'database' } : {},
    };
    f.step.preconditions = {};
    f.executionStep.tool_name = f.step.tool_name;
    f.executionStep.minimal_scope = f.step.scope;
    f.executionStep.template_hash = f.validate.hash({
      command_template: f.step.command_template,
      output_bindings: [],
      preconditions: {},
    });
    f.executionStep.bound_command_hash = f.validate.hash(
      nodiaAiFinancialBinding(f.step),
    );
    f.executionStep.minimal_receipt = {
      schema_version: 1,
      resource_key: resource,
      operation,
      resource_id: id,
      property_id: property,
    };
    f.execution.minimal_scope.steps[0].tool_name = f.step.tool_name;
    f.execution.minimal_scope.steps[0].scope = f.step.scope;
    return f;
  }
  it.each([
    ['rental_properties', 'create'],
    ['rental_properties', 'update'],
    ['rental_collaborators', 'create'],
    ['rental_collaborators', 'update'],
    ['rental_cancellation_policies', 'create'],
    ['rental_cancellation_policies', 'update'],
    ['rental_reservations', 'create'],
    ['rental_reservations', 'update'],
    ['rental_reservations', 'confirm'],
    ['rental_reservations', 'start'],
    ['rental_reservations', 'complete'],
    ['rental_reservations', 'cancel'],
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
  ])(
    'projects the historical %s/%s receipt without refreshing native state',
    async (resource, operation) => {
      const f = await rentalReceipt(resource, operation);
      const result = await f.useCase.execute(f.identity, f.execution.id);
      expect(result.steps[0].result_refs).toEqual([
        { resource_key: resource, id: '9007199254740993' },
      ]);
      expect(f.preparer.prepare).not.toHaveBeenCalled();
      expect(f.store.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    { property_id: '8' },
    { property_id: 7 },
    { resource_id: '8' },
    { operation: 'delete' },
    { resource_key: 'rental_payments' },
    { command: { is_active: false } },
  ])(
    'rejects a rental witness inconsistent with its frozen scope: %j',
    async (delta) => {
      const f = await rentalReceipt('rental_collaborators', 'update');
      Object.assign(f.executionStep.minimal_receipt!, delta);
      await expect(
        f.useCase.execute(f.identity, f.execution.id),
      ).rejects.toThrow('nodia_ai:invalid_persisted_state');
    },
  );
  it('rejects a property creation receipt whose property and resource identities differ', async () => {
    const f = await rentalReceipt('rental_properties', 'create');
    f.executionStep.minimal_receipt!.property_id = '8';
    await expect(f.useCase.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
  });
  it.each([
    'resource_id',
    'property_id',
    'operation',
    'command_property',
    'scope_property',
  ])(
    'rejects a reservation lifecycle receipt with a changed %s',
    async (variant) => {
      const f = await rentalReceipt('rental_reservations', 'cancel');
      if (variant === 'resource_id')
        f.executionStep.minimal_receipt!.resource_id = '8';
      if (variant === 'property_id')
        f.executionStep.minimal_receipt!.property_id = '8';
      if (variant === 'operation')
        f.executionStep.minimal_receipt!.operation = 'complete';
      if (variant === 'command_property')
        f.step.command_template.property_id = '8';
      if (variant === 'scope_property') f.step.scope.property_id = '8';
      await expect(
        f.useCase.execute(f.identity, f.execution.id),
      ).rejects.toThrow('nodia_ai:invalid_persisted_state');
    },
  );
  it.each([
    ['rental_payments', 'void', 'create'],
    ['rental_expenses', 'pay', 'void'],
    ['rental_blocks', 'update', 'create'],
    ['rental_turnovers', 'approve_same_day', 'update'],
  ])(
    'rejects %s/%s receipts relabeled as %s',
    async (resource, original, altered) => {
      const f = await rentalReceipt(resource, original);
      f.executionStep.minimal_receipt!.operation = altered;
      await expect(
        f.useCase.execute(f.identity, f.execution.id),
      ).rejects.toThrow('nodia_ai:invalid_persisted_state');
    },
  );
  it.each([
    'rental_payments',
    'rental_expenses',
    'rental_blocks',
    'rental_turnovers',
  ])(
    'rejects an AI26 receipt whose house differs from the approved scope: %s',
    async (resource) => {
      const f = await rentalReceipt(
        resource,
        resource === 'rental_payments' ? 'void' : 'update',
      );
      f.executionStep.minimal_receipt!.property_id = '8';
      await expect(
        f.useCase.execute(f.identity, f.execution.id),
      ).rejects.toThrow('nodia_ai:invalid_persisted_state');
    },
  );
  it.each([
    ['businesses', 'create', '22222222-2222-4222-8222-222222222222'],
    ['businesses', 'set_collaborators', '11111111-1111-4111-8111-111111111111'],
    ['product_logs', 'update', '22222222-2222-4222-8222-222222222222'],
    ['products', 'create', '9007199254740993'],
    ['providers', 'update', '9007199254740993'],
    ['provider_contacts', 'set_active', '9007199254740993'],
    ['invoices', 'create', '9007199254740993'],
  ])(
    'projects %s/%s evidence with its native identity format',
    async (resource, operation, id) => {
      const f = await businessReceipt(resource, operation, id);
      const result = await f.useCase.execute(f.identity, f.execution.id);
      expect(result.steps[0].result_refs).toEqual([
        { resource_key: resource, id },
      ]);
      expect(f.store.create).not.toHaveBeenCalled();
    },
  );
  it.each(['destination', 'origin', 'id_kind', 'target', 'operation', 'extra'])(
    'rejects corrupt business witness: %s',
    async (variant) => {
      const f = await businessReceipt('invoices', 'update', '9007199254740993');
      if (variant === 'destination')
        f.executionStep.minimal_receipt!.business_id =
          '22222222-2222-4222-8222-222222222222';
      if (variant === 'origin')
        f.step.scope.business_id = '22222222-2222-4222-8222-222222222222';
      if (variant === 'id_kind')
        f.executionStep.minimal_receipt!.resource_id =
          '22222222-2222-4222-8222-222222222222';
      if (variant === 'target')
        f.executionStep.minimal_receipt!.resource_id = '2';
      if (variant === 'operation')
        f.executionStep.minimal_receipt!.operation = 'set_active';
      if (variant === 'extra')
        f.executionStep.minimal_receipt!.storage_key =
          'synthetic-forbidden-key';
      await expect(
        f.useCase.execute(f.identity, f.execution.id),
      ).rejects.toThrow('nodia_ai:invalid_persisted_state');
    },
  );
  it.each([
    'finance_categories',
    'finance_category_groups',
    'finance_movements',
    'finance_obligations',
  ])(
    'serves a historical delete receipt for %s without requiring the deleted record',
    async (resource) => {
      const f = await financialReceipt(resource, 'delete');
      const result = await f.useCase.execute(f.identity, f.execution.id);
      expect(result.steps[0].result_refs).toEqual([
        { resource_key: resource, id: '9007199254740993' },
      ]);
      expect(f.preparer.prepare).not.toHaveBeenCalled();
      expect(f.store.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    'resource',
    'operation',
    'target',
    'binding_target',
    'missing_operation',
  ])('rejects mismatched financial evidence: %s', async (variant) => {
    const f = await financialReceipt('finance_obligations', 'update');
    if (variant === 'resource')
      f.executionStep.minimal_receipt!.resource_key = 'finance_movements';
    if (variant === 'operation')
      f.executionStep.minimal_receipt!.operation = 'delete';
    if (variant === 'target')
      f.executionStep.minimal_receipt!.resource_id = '2';
    if (variant === 'binding_target') {
      f.executionStep.bound_command_hash = f.validate.hash(
        nodiaAiFinancialBinding({
          ...f.step,
          command_template: { ...f.step.command_template, id: '2' },
        }),
      );
    }
    if (variant === 'missing_operation')
      delete f.executionStep.minimal_receipt!.operation;
    await expect(f.useCase.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
  });
  it('rereads the header after waiting for the chat lock so a completed receipt has a completed header', async () => {
    const f = await completed();
    f.execution.revision = 3;
    f.store.execution.mockResolvedValueOnce({
      ...f.execution,
      state: 'queued',
      revision: 1,
      completed_at: null,
    });
    const result = await f.useCase.execute(f.identity, f.execution.id);
    expect(result.state).toBe('completed');
    expect(result.revision).toBe(3);
    expect(f.store.execution).toHaveBeenCalledTimes(2);
  });
  it.each([
    'number',
    'overflow',
    'owner',
    'extra',
    'binding',
    'missing_time',
    'pending_step',
  ] as const)('rejects corrupt completed witness: %s', async (variant) => {
    const f = await completed();
    if (variant === 'number') f.executionStep.minimal_receipt!.resource_id = 1;
    if (variant === 'overflow')
      f.executionStep.minimal_receipt!.resource_id = '9223372036854775808';
    if (variant === 'owner')
      f.executionStep.minimal_receipt!.subject_user_id = '2';
    if (variant === 'extra')
      f.executionStep.minimal_receipt!.confirmation_token =
        'synthetic forbidden field';
    if (variant === 'binding')
      f.executionStep.bound_command_hash = 'b'.repeat(64);
    if (variant === 'missing_time') f.execution.completed_at = null;
    if (variant === 'pending_step') f.executionStep.state = 'ready';
    await expect(f.useCase.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
  });
  it('projects an admitted dependent set while its future step is still blocked', async () => {
    const f = fixture();
    const source = Object.assign(
      new NodiaAiProposalStep(),
      structuredClone(f.step),
      { id: randomUUID(), position: 2 },
    );
    source.public_step = { ...source.public_step, step_id: source.id };
    const [first] = await f.store.steps();
    const pending = Object.assign(
      new NodiaAiExecutionStep(),
      structuredClone(first),
      {
        id: source.id,
        source_step_id: source.id,
        position: 2,
        state: 'blocked',
        template_hash: f.validate.hash({
          command_template: source.command_template,
          output_bindings: source.output_bindings,
          preconditions: source.preconditions,
        }),
      },
    );
    f.loaded.steps.push(source);
    f.execution.minimal_scope.steps.push({
      step_id: source.id,
      tool_name: source.tool_name,
      contract_hash: source.contract_hash,
      scope: source.scope,
    });
    f.store.steps.mockResolvedValue([first, pending]);
    const result = await f.useCase.execute(f.identity, f.execution.id);
    expect(result).toMatchObject({
      state: 'queued',
      steps: [{ state: 'ready' }, { state: 'blocked' }],
    });
    expect(f.preparer.prepare).not.toHaveBeenCalled();
  });
  it.each(['valid', 'receipt', 'dispatch', 'completion'] as const)(
    'projects skipped suffix only when it carries no effect witness: %s',
    async (variant) => {
      const f = fixture();
      const source = Object.assign(
        new NodiaAiProposalStep(),
        structuredClone(f.step),
        { id: randomUUID(), position: 2 },
      );
      source.public_step = { ...source.public_step, step_id: source.id };
      const [first] = await f.store.steps();
      first.state = 'cancelled';
      const skipped = Object.assign(
        new NodiaAiExecutionStep(),
        structuredClone(first),
        {
          id: source.id,
          source_step_id: source.id,
          position: 2,
          state: 'skipped',
        },
      );
      if (variant === 'receipt')
        skipped.minimal_receipt = { resource_id: '41' };
      if (variant === 'dispatch') skipped.dispatched_at = f.now;
      if (variant === 'completion') skipped.completed_at = f.now;
      f.loaded.steps.push(source);
      f.execution.minimal_scope.steps.push({
        step_id: source.id,
        tool_name: source.tool_name,
        contract_hash: source.contract_hash,
        scope: source.scope,
      });
      f.execution.state = 'cancelled';
      f.execution.completed_at = f.now;
      f.store.steps.mockResolvedValue([first, skipped]);
      if (variant === 'valid') {
        const result = await f.useCase.execute(f.identity, f.execution.id);
        expect(result).toMatchObject({
          state: 'cancelled',
          steps: [
            { state: 'cancelled' },
            { state: 'skipped', result_refs: [] },
          ],
        });
      } else
        await expect(
          f.useCase.execute(f.identity, f.execution.id),
        ).rejects.toThrow('nodia_ai:invalid_persisted_state');
    },
  );
  it('projects durable queued state under current authority without creating work', async () => {
    const f = fixture();
    const result = await f.useCase.execute(f.identity, f.execution.id);
    expect(result.state).toBe('queued');
    expect(result.execution_id).toBe(f.execution.id);
    expect(result.steps).toEqual([
      { step_id: f.step.id, state: 'ready', result_refs: [], error: null },
    ]);
    expect(f.store.create).not.toHaveBeenCalled();
    expect(f.preparer.prepare).not.toHaveBeenCalled();
  });
  it('refuses to serve state after resource revocation', async () => {
    const f = fixture();
    f.get.load.mockRejectedValueOnce(
      new ForbiddenException('nodia_ai:capability_denied'),
    );
    await expect(f.useCase.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:capability_denied',
    );
  });
  it.each(['missing', 'detached', 'chat_mismatch', 'hash_mismatch'])(
    'does not recover %s execution references',
    async (reason) => {
      const f = fixture();
      if (reason === 'missing') f.store.execution.mockResolvedValueOnce(null);
      if (reason === 'detached') f.execution.proposal_id = null;
      if (reason === 'chat_mismatch')
        f.execution.origin_conversation_id = f.proposal.id;
      if (reason === 'hash_mismatch')
        f.execution.proposal_hash = 'b'.repeat(64);
      await expect(
        f.useCase.execute(f.identity, f.execution.id),
      ).rejects.toThrow('nodia_ai:operation_not_found');
    },
  );
  it('rejects missing steps rather than projecting an empty successful approval', async () => {
    const f = fixture();
    f.store.steps.mockResolvedValueOnce([]);
    await expect(f.useCase.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
  });
  it('detects corrupted execution template identities against the immutable source', async () => {
    const f = fixture();
    const steps = await f.store.steps();
    steps[0].template_hash = 'b'.repeat(64);
    await expect(f.useCase.execute(f.identity, f.execution.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
  });
  it.each([
    'valid',
    'different_receipt_id',
    'known_field',
    'extra_condition',
  ] as const)(
    'checks historical first-bound dependent intent and predecessor receipt: %s',
    async (variant) => {
      const f = await businessReceipt(
        'providers',
        'create',
        '9007199254740993',
      );
      const business = String(f.step.scope.business_id);
      const expected = {
        business_id: business,
        name: 'Proveedor',
        tax: 19,
        fields: {},
        is_active: true,
      };
      f.execution.state = 'queued';
      f.execution.completed_at = null;
      f.execution.catalog_version = f.revision.catalog_version =
        'nodia-ai-ai23-workflow/1';
      f.executionStep.bound_command = {
        command_template: f.step.command_template,
        scope: f.step.scope,
        preconditions: f.step.preconditions,
      };
      f.executionStep.bound_command_hash = f.validate.hash(
        nodiaAiBoundExecutionBinding(f.step, true),
      );
      const source = Object.assign(
        new NodiaAiProposalStep(),
        structuredClone(f.step),
        {
          id: randomUUID(),
          position: 2,
          tool_name: 'nodia_provider_contacts_prepare_create',
          command_template: {
            schema_version: 1,
            business_id: business,
            command: { name: 'Contacto', request_key: randomUUID() },
          },
          preconditions: {
            destination_business_id: business,
            provider: null,
            future_provider: {
              from_step_id: f.step.id,
              source_contract_hash: f.step.contract_hash,
              expected_provider: expected,
            },
          },
          output_bindings: [
            {
              target_field_key: 'provider_id',
              from_step_id: f.step.id,
              output_key: 'id',
            },
          ],
        },
      );
      const boundId =
        variant === 'different_receipt_id'
          ? '9007199254740994'
          : '9007199254740993';
      const bound = {
        command_template: {
          ...structuredClone(source.command_template),
          provider_id: boundId,
        },
        scope: { ...source.scope, provider_id: boundId },
        preconditions: {
          destination_business_id: business,
          provider: {
            ...expected,
            id: boundId,
            updated_at: f.now.toISOString(),
          },
        },
      };
      if (variant === 'known_field')
        bound.command_template.command.name = 'Tampered';
      if (variant === 'extra_condition')
        Object.assign(bound.preconditions, { unapproved: true });
      const pending = Object.assign(
        new NodiaAiExecutionStep(),
        structuredClone(f.executionStep),
        {
          id: source.id,
          source_step_id: source.id,
          position: 2,
          tool_name: source.tool_name,
          state: 'ready',
          minimal_receipt: null,
          dispatched_at: null,
          completed_at: null,
          bound_command: bound,
          minimal_scope: source.scope,
          template_hash: f.validate.hash({
            command_template: source.command_template,
            output_bindings: source.output_bindings,
            preconditions: source.preconditions,
          }),
          bound_command_hash: f.validate.hash(
            nodiaAiBoundExecutionBinding(
              {
                ...source,
                command_template: bound.command_template,
                scope: bound.scope,
                preconditions: bound.preconditions,
              },
              true,
            ),
          ),
        },
      );
      f.loaded.steps.push(source);
      f.execution.minimal_scope.steps.push({
        step_id: source.id,
        tool_name: source.tool_name,
        contract_hash: source.contract_hash,
        scope: source.scope,
      });
      f.store.steps.mockResolvedValue([f.executionStep, pending]);
      if (variant === 'valid') {
        const result = await f.useCase.execute(f.identity, f.execution.id);
        expect(result.steps[0].result_refs).toEqual([
          { resource_key: 'providers', id: '9007199254740993' },
        ]);
      } else
        await expect(
          f.useCase.execute(f.identity, f.execution.id),
        ).rejects.toThrow('nodia_ai:invalid_persisted_state');
      expect(f.preparer.prepare).not.toHaveBeenCalled();
    },
  );
});
