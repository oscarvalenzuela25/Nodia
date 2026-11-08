import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { withCoreAuthorityLock } from '../../authorization/core-authority-transaction.js';
import { NodiaAiProposal } from '../../nodia-ai-proposal/entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from '../../nodia-ai-proposal/entities/nodia-ai-proposal-step.entity.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  ProposalPreparerContext,
  StoredProposalStep,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import { runtimeFixture } from '../../nodia-ai-runtime/use-case/runtime.fixture.js';
import type { NodiaAiCoreOperationsService } from '../nodia-ai-core-operations.service.js';
import type {
  NodiaAiCoreResource as Resource,
  NodiaAiCoreAction as Action,
} from '../types/core-operation.types.js';
import { BuildNodiaAiCoreOperationsUseCase } from './build-nodia-ai-core-operations.use-case.js';

const session = '1057a24d-4d46-4ca2-93c3-3711284cfb76';
const resources: Resource[] = [
  'users',
  'roles',
  'actions',
  'business_actions',
  'modules',
  'module_groups',
];
const pairs = resources.flatMap((resource) =>
  (resource === 'users'
    ? ['create', 'update']
    : ['create', 'update', 'delete']
  ).map((action) => [resource, action] as [Resource, Action]),
);
function fixture() {
  const targets: Record<Resource, NodiaAiJsonObject> = {
    users: {
      id: '20',
      name: 'Persona',
      email: 'user@example.test',
      image_url: null,
      is_active: true,
    },
    roles: { id: '20', key: 'manager', is_active: true },
    actions: { id: '20', key: 'read', description: 'Lectura', is_active: true },
    business_actions: {
      id: '20',
      key: 'log',
      has_description: false,
      is_active: true,
    },
    modules: {
      id: '20',
      key: 'finance',
      module_group_id: '50',
      link: '/finance',
      icon: null,
      is_active: true,
    },
    module_groups: { id: '20', key: 'tools', icon: null, is_active: true },
  };
  const catalogs = {
    roles: [
      { id: '30', label: 'reader', is_active: true },
      { id: '31', label: 'super_admin', is_active: true },
    ],
    modules: [
      {
        id: '40',
        label: 'finance',
        is_active: true,
        module_group_id: '50',
        link: '/finance',
      },
    ],
    actions: [{ id: '60', label: 'view', is_active: true }],
    module_groups: [{ id: '50', label: 'tools', is_active: true }],
  };
  const state = {
    authenticated: true,
    existing: false,
    missing: false,
    collision: false,
    affected: [
      {
        id: '21',
        name: 'Otra persona',
        email: 'other@example.test',
        is_active: true,
      },
    ],
    groupModules: [] as NodiaAiJsonObject[],
    admins: [{ id: '20' }, { id: '21' }] as NodiaAiJsonObject[],
    superAdmin: false,
  };
  const assignments: NodiaAiJsonObject = {
    roles: [
      { id: '30', label: 'reader', is_active: true, assignment_active: true },
    ],
    modules: [
      { id: '40', label: 'finance', is_active: true, assignment_active: true },
    ],
    actions: [
      { id: '60', label: 'view', is_active: true, assignment_active: true },
    ],
  };
  const translations: NodiaAiJsonObject[] = [
    { key: 'name', es: 'Nombre', en: 'Name' },
  ];
  const query = vi.fn(async (sql: string) =>
    sql.startsWith('SELECT u.id')
      ? state.authenticated
        ? [{ actorId: '1', sessionId: session, isSuperAdmin: state.superAdmin }]
        : []
      : [],
  );
  const manager = {
    query,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  const store = {
    target: vi.fn(
      async (
        _manager: EntityManager,
        resource: Resource,
        id?: string,
        identity?: string,
      ) =>
        state.missing
          ? null
          : id
            ? structuredClone(targets[resource])
            : state.collision
              ? { ...targets[resource], id: '99' }
              : state.existing && identity
                ? structuredClone(targets[resource])
                : null,
    ),
    translations: vi.fn(async () => structuredClone(translations)),
    associations: vi.fn(async (_manager: EntityManager, resource: Resource) =>
      structuredClone(
        resource === 'users'
          ? { roles: assignments.roles, modules: assignments.modules }
          : resource === 'roles'
            ? { actions: assignments.actions }
            : {},
      ),
    ),
    catalog: vi.fn(
      async (
        _manager: EntityManager,
        resource: keyof typeof catalogs,
        ids: string[],
      ) =>
        structuredClone(
          catalogs[resource].filter((row) => ids.includes(row.id)),
        ),
    ),
    actionKeys: vi.fn(async (_manager: EntityManager, values: string[]) =>
      structuredClone(
        catalogs.actions.filter(
          (row) => values.includes(row.id) || values.includes(row.label),
        ),
      ),
    ),
    affectedUsers: vi.fn(async (_manager: EntityManager, resource: Resource) =>
      resource === 'business_actions' ? [] : structuredClone(state.affected),
    ),
    groupModules: vi.fn(async () => structuredClone(state.groupModules)),
    superAdmins: vi.fn(async () => structuredClone(state.admins)),
  };
  const writers = Array.from({ length: 12 }, () => ({
    execute: vi.fn(async (...args: unknown[]) => ({
      id: typeof args[0] === 'string' ? args[0] : state.existing ? '20' : '99',
    })),
  }));
  const factory = new BuildNodiaAiCoreOperationsUseCase(
    store as unknown as NodiaAiCoreOperationsService,
    ...(writers as unknown as ConstructorParameters<
      typeof BuildNodiaAiCoreOperationsUseCase
    > extends [unknown, ...infer R]
      ? R
      : never),
  );
  const ctx = {
    actor: { actorId: '1', sessionId: session, isSuperAdmin: false },
    manager,
    moduleRoutes: [
      '/users',
      '/roles',
      '/actions',
      '/modules',
    ],
    conversationId: session,
    statementTimeoutMs: 1200,
  } as ProposalPreparerContext;
  const op = (resource: Resource, action: Action) =>
    factory.operations.find(
      (port) => port.resourceKey === resource && port.operation === action,
    )!;
  const input = (resource: Resource, action: Action): NodiaAiJsonObject =>
    action === 'delete'
      ? { id: '20' }
      : action === 'update'
        ? { id: '20', is_active: false }
        : resource === 'users'
          ? { email: 'new@example.test' }
          : resource === 'modules'
            ? { key: 'new_module', module_group_id: '50', link: '/new' }
            : { key: 'new_key' };
  async function ready(
    resource: Resource,
    action: Action,
    raw = input(resource, action),
  ) {
    const port = op(resource, action),
      prepared = await port.prepare(raw, ctx);
    if (prepared.status !== 'ready') throw new Error('not ready');
    const step: StoredProposalStep = {
      id: session,
      toolName: port.toolName,
      contractHash: port.contractHash,
      position: 0,
      outputBindings: [],
      ...prepared,
    };
    return { port, step };
  }
  return {
    targets,
    catalogs,
    state,
    assignments,
    translations,
    query,
    manager,
    store,
    writers,
    factory,
    ctx,
    op,
    input,
    ready,
  };
}
const policy = runtimeFixture().policy;
const validator = new ValidateNodiaAiProposalUseCase(
  fixture().factory.operations,
  readFileSync(
    new URL(
      '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
      import.meta.url,
    ),
    'utf8',
  ),
  policy,
  new CanonicalizeNodiaAiProposalUseCase(policy),
);

describe('Build NodiaAI Core operations', () => {
  it.each(pairs)(
    'prepares closed %s/%s with exact public projection and no side effect',
    async (resource, action) => {
      const f = fixture(),
        { step } = await f.ready(resource, action);
      validator.assert('PublicStep', { ...step.publicStep, step_id: step.id });
      const now = new Date('2030-05-03T12:00:00Z');
      const proposal = Object.assign(new NodiaAiProposal(), {
        id: session,
        conversation_id: session,
        actor_id: '1',
        current_revision: 1,
        created_at: now,
      });
      const revision = Object.assign(new NodiaAiProposalRevision(), {
        proposal_id: session,
        revision: 1,
        state: 'ready',
        hash: '',
        catalog_version: f.op(resource, action).catalogVersion,
        canonicalization_version: 'jcs-rfc8785/1',
        created_at: now,
        expires_at: new Date(now.getTime() + 900000),
      });
      const stored = Object.assign(new NodiaAiProposalStep(), {
        id: step.id,
        proposal_id: session,
        proposal_revision: 1,
        position: 1,
        tool_name: step.toolName,
        contract_hash: step.contractHash,
        kind: 'domain_change',
        effect_key: step.publicStep.effect_key,
        scope: step.scope,
        command_template: step.commandTemplate,
        preconditions: step.preconditions,
        output_bindings: [],
        public_step: { ...step.publicStep, step_id: step.id },
      });
      expect(() =>
        validator.compile(proposal, revision, [stored], false),
      ).not.toThrow();
      expect(step.scope).toEqual({});
      expect(f.writers.every((w) => w.execute.mock.calls.length === 0)).toBe(
        true,
      );
      expect(JSON.stringify(step)).not.toMatch(
        /google_sub|password|access_token/,
      );
    },
  );
  it.each(pairs)(
    'executes %s/%s only under preexisting exclusive frontier',
    async (resource, action) => {
      const f = fixture(),
        { port, step } = await f.ready(resource, action);
      await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
        'authorization:exclusive_transaction_required',
      );
      f.query.mockClear();
      await withCoreAuthorityLock(f.manager, 1200, async () => {
        f.query.mockClear();
        await expect(port.executeConfirmed(step, f.ctx)).resolves.toEqual({
          id: action === 'create' ? '99' : '20',
        });
        expect(
          f.query.mock.calls.some(
            ([sql]) => sql.startsWith('LOCK') || sql.startsWith('SET'),
          ),
        ).toBe(false);
      });
      await expect(port.executeConfirmed(step, f.ctx)).rejects.toThrow(
        'authorization:exclusive_transaction_required',
      );
    },
  );
  it.each([
    'users',
    'roles',
    'actions',
    'business_actions',
    'modules',
    'module_groups',
  ] as Resource[])(
    'resolves existing %s create before confirmation without silent defaults',
    async (resource) => {
      const f = fixture();
      f.state.existing = true;
      const raw = f.input(resource, 'create');
      if (resource !== 'users') raw.key = f.targets[resource].key;
      const { port, step } = await f.ready(resource, 'create', raw);
      expect(step.preconditions.identity).toBe('20');
      expect(step.publicStep.target).toMatchObject({ id: '20' });
      expect(step.commandTemplate.command).not.toHaveProperty('is_active');
      await withCoreAuthorityLock(f.manager, 1200, async () =>
        expect(port.executeConfirmed(step, f.ctx)).resolves.toEqual({
          id: '20',
        }),
      );
      f.state.existing = false;
      await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
        'nodia_ai:preconditions_changed',
      );
    },
  );
  it.each([
    'password',
    'google_sub',
    'access_token',
    'actor_id',
    'owner_id',
    'schema_version',
    'command',
  ])('rejects unregistered input %s', async (key) => {
    const f = fixture();
    await expect(
      f
        .op('users', 'create')
        .prepare({ email: 'new@example.test', [key]: 'secret' }, f.ctx),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it.each([0, '0', '01', '-1', '9223372036854775808', null])(
    'rejects noncanonical bigint identity %s',
    async (id) => {
      const f = fixture();
      await expect(
        f.op('users', 'update').prepare({ id, is_active: false }, f.ctx),
      ).rejects.toThrow('nodia_ai:invalid_input');
    },
  );
  it('asks for required fields without guessing', async () => {
    const f = fixture();
    expect(
      await f.op('modules', 'create').prepare({ key: 'new' }, f.ctx),
    ).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['module_group_id', 'link'],
    });
    expect(
      await f.op('users', 'update').prepare({ id: '20' }, f.ctx),
    ).toMatchObject({
      status: 'needs_clarification',
      missingFields: ['changes'],
    });
  });
  it('merges clarification state and freezes defaults, preserving null/false/empty arrays', async () => {
    const f = fixture(),
      port = f.op('users', 'create'),
      partial = await port.prepare(
        { name: null, is_active: false, roles: [] },
        f.ctx,
      );
    if (partial.status !== 'needs_clarification')
      throw new Error('expected clarification');
    const result = await port.prepare(
      { email: ' NEW@EXAMPLE.TEST ' },
      f.ctx,
      partial.partial,
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.commandTemplate.command).toMatchObject({
      email: 'new@example.test',
      name: null,
      is_active: false,
      roles: [],
      modules: [],
    });
  });
  it('resolves action keys to stable IDs, deduplicates and freezes labels', async () => {
    const f = fixture(),
      { step } = await f.ready('roles', 'update', {
        id: '20',
        actions: ['view', '60'],
      });
    expect(step.commandTemplate.command).toMatchObject({ actions: ['60'] });
    f.catalogs.actions[0].label = 'renamed';
    await expect(
      f.op('roles', 'update').verifyPreconditions(step, f.ctx),
    ).rejects.toThrow('nodia_ai:preconditions_changed');
  });
  it('keeps numeric IDs distinct from another action with a numeric key', async () => {
    const f = fixture();
    f.catalogs.actions.push({ id: '61', label: '60', is_active: true });
    const { step } = await f.ready('roles', 'update', {
      id: '20',
      actions: ['60', '61'],
    });
    expect(step.commandTemplate.command).toMatchObject({
      actions: ['60', '61'],
    });
  });
  it('rejects missing associations before a proposal', async () => {
    const f = fixture();
    await expect(
      f.op('users', 'update').prepare({ id: '20', roles: ['999'] }, f.ctx),
    ).rejects.toThrow('users:invalid_associations');
    await expect(
      f
        .op('roles', 'update')
        .prepare({ id: '20', actions: ['unknown'] }, f.ctx),
    ).rejects.toThrow('roles:invalid_actions');
    await expect(
      f
        .op('modules', 'create')
        .prepare({ key: 'new', module_group_id: '999', link: '/new' }, f.ctx),
    ).rejects.toThrow('modules:groups.not_found');
  });
  it('bounds associations and nested translations and rejects duplicate translation keys', async () => {
    const f = fixture();
    for (const raw of [
      { roles: Array.from({ length: 101 }, (_, i) => String(i + 1)) },
      {
        translates: [
          { key: 'name', es: 'Uno', en: 'One' },
          { key: 'name', es: 'Dos', en: 'Two' },
        ],
      },
      { translates: [{ key: 'name', es: 'Uno', en: 'One', secret: 'x' }] },
    ]) {
      const resource = 'roles' in raw ? 'users' : 'roles';
      await expect(
        f.op(resource, 'update').prepare({ id: '20', ...raw }, f.ctx),
      ).rejects.toThrow('nodia_ai:invalid_input');
    }
  });
  it('enforces nested translation limits in UTF-8 bytes', async () => {
    const f = fixture();
    await expect(
      f.op('roles', 'update').prepare(
        {
          id: '20',
          translates: [{ key: 'name', es: 'á'.repeat(2501), en: 'Name' }],
        },
        f.ctx,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
    await expect(
      f.op('roles', 'update').prepare(
        {
          id: '20',
          translates: [{ key: 'á'.repeat(128), es: 'Nombre', en: 'Name' }],
        },
        f.ctx,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  it('detects assignment active-state and access-loss changes before effects', async () => {
    const f = fixture(),
      { port, step } = await f.ready('users', 'update', {
        id: '20',
        roles: [],
      });
    expect(JSON.stringify(step.publicStep)).toContain('reader');
    f.assignments.roles = [
      { id: '30', label: 'reader', is_active: true, assignment_active: false },
    ];
    await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
  });
  it('detects affected user and translation changes even without timestamps', async () => {
    const f = fixture(),
      { port, step } = await f.ready('roles', 'delete');
    f.state.affected[0].email = 'changed@example.test';
    await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
    f.state.affected[0].email = 'other@example.test';
    f.translations[0].es = 'Cambiado';
    await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
  });
  it('refuses loss of last active superadmin and freezes concurrent administrator set', async () => {
    const f = fixture();
    f.assignments.roles = [
      {
        id: '31',
        label: 'super_admin',
        is_active: true,
        assignment_active: true,
      },
    ];
    const { port, step } = await f.ready('users', 'update', {
      id: '20',
      roles: [],
    });
    f.state.admins = [{ id: '20' }];
    await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
      'users:last_super_admin',
    );
    await expect(
      port.prepare({ id: '20', is_active: false }, f.ctx),
    ).rejects.toThrow('users:last_super_admin');
  });
  it.each(['delete', 'update'] as Action[])(
    'protects reserved superadmin during %s',
    async (action) => {
      const f = fixture();
      f.targets.roles.key = 'super_admin';
      await expect(
        f.op('roles', action).prepare(f.input('roles', action), f.ctx),
      ).rejects.toThrow('roles:protected_role');
    },
  );
  it('prevents reserved role creation, reserved key mutation and module key mutation', async () => {
    const f = fixture();
    await expect(
      f.op('roles', 'create').prepare({ key: 'super_admin' }, f.ctx),
    ).rejects.toThrow('roles:protected_role');
    f.targets.roles.key = 'super_admin';
    await expect(
      f.op('roles', 'update').prepare({ id: '20', key: 'renamed' }, f.ctx),
    ).rejects.toThrow('roles:protected_key');
    await expect(
      f.op('modules', 'update').prepare({ id: '20', key: 'renamed' }, f.ctx),
    ).rejects.toThrow('modules:immutable_key');
  });
  it('rejects deletion of groups with children and detects a newly attached child', async () => {
    const f = fixture(),
      { port, step } = await f.ready('module_groups', 'delete');
    f.state.groupModules = [{ id: '90', label: 'child', is_active: false }];
    await expect(port.verifyPreconditions(step, f.ctx)).rejects.toThrow(
      'nodia_ai:preconditions_changed',
    );
    await expect(port.prepare({ id: '20' }, f.ctx)).rejects.toThrow(
      'modules:groups.delete_has_modules',
    );
  });
  it('presents business-action delete as deactivation, never physical deletion', async () => {
    const f = fixture(),
      { step } = await f.ready('business_actions', 'delete');
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'deletion_mode',
        after: 'deactivate',
      }),
    );
    expect(step.publicStep.changes).toContainEqual(
      expect.objectContaining({
        field_key: 'is_active',
        before: true,
        before_present: true,
        after: false,
        after_present: true,
      }),
    );
    expect(step.preconditions.access_impact).toMatchObject({
      affected_users: [],
      deactivates_access: false,
    });
  });
  it('rechecks real session and requires assigned destination', async () => {
    const f = fixture();
    f.state.authenticated = false;
    await expect(
      f.op('users', 'create').prepare({ email: 'new@example.test' }, f.ctx),
    ).rejects.toThrow('auth:session_expired');
    f.state.authenticated = true;
    await expect(
      f
        .op('users', 'create')
        .prepare({ email: 'new@example.test' }, { ...f.ctx, moduleRoutes: [] }),
    ).rejects.toThrow('nodia_ai:capability_denied');
  });
  it('rejects tampered scope, hash and template before effects', async () => {
    const f = fixture(),
      { port, step } = await f.ready('users', 'update');
    for (const changed of [
      { ...step, scope: { owner_id: '2' } },
      { ...step, contractHash: '0'.repeat(64) },
      { ...step, commandTemplate: { ...step.commandTemplate, secret: 'x' } },
    ])
      await expect(port.verifyAuthority(changed, f.ctx)).rejects.toThrow();
    expect(f.writers.every((w) => !w.execute.mock.calls.length)).toBe(true);
  });
  it('edits associations/translations through registered fields and rejects readonly edits', async () => {
    const f = fixture(),
      { port, step } = await f.ready('roles', 'update', {
        id: '20',
        actions: [],
      });
    const template = await port.applyEdits(
      step.commandTemplate,
      [
        { step_id: session, field_key: 'actions', value: ['60'] },
        {
          step_id: session,
          field_key: 'translates',
          value: [{ key: 'name', es: 'Gestor', en: 'Manager' }],
        },
      ],
      f.ctx,
    );
    expect(await port.reprepareStored(template, f.ctx)).toMatchObject({
      status: 'ready',
      commandTemplate: { command: { actions: ['60'] } },
    });
    await expect(
      port.applyEdits(
        template,
        [{ step_id: session, field_key: 'access_impact', value: {} }],
        f.ctx,
      ),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });
  for (const resource of [
    'roles',
    'actions',
    'business_actions',
    'modules',
    'module_groups',
  ] as Resource[]) {
    it(`${resource} previews native translation upsert with old keys preserved`, async () => {
      const f = fixture(),
        { step } = await f.ready(resource, 'update', {
          id: '20',
          translates: [{ key: 'description', es: 'Detalle', en: 'Detail' }],
        });
      expect(
        (step.commandTemplate.command as NodiaAiJsonObject).translates,
      ).toEqual([
        { key: 'description', es: 'Detalle', en: 'Detail' },
        ...f.translations,
      ]);
      expect(step.preconditions.translation_semantics).toBe('upsert-preview/1');
    });
    it(`${resource} rejects a false empty translation deletion preview`, async () => {
      const f = fixture();
      await expect(
        f.ready(resource, 'update', { id: '20', translates: [] }),
      ).rejects.toThrow('core_translation_removal_unsupported');
    });
    it(`${resource} preserves persisted translation keys while editing a draft`, async () => {
      const f = fixture(),
        { port, step } = await f.ready(resource, 'update', {
          id: '20',
          translates: f.translations,
        });
      await expect(
        port.applyEdits(
          step.commandTemplate,
          [{ step_id: session, field_key: 'translates', value: [] }],
          f.ctx,
        ),
      ).rejects.toThrow('core_translation_removal_unsupported');
    });
  }
  it('blocks a previously confirmed translation proposal without its material marker but permits authority recovery', async () => {
    const f = fixture(),
      { port, step } = await f.ready('roles', 'update', {
        id: '20',
        translates: f.translations,
      });
    delete step.preconditions.translation_semantics;
    await expect(port.verifyAuthority(step, f.ctx)).resolves.toBeUndefined();
    await expect(
      withCoreAuthorityLock(f.manager, 1000, () =>
        port.executeConfirmed(step, f.ctx),
      ),
    ).rejects.toThrow('preconditions_changed');
    expect(f.writers.every((writer) => !writer.execute.mock.calls.length)).toBe(
      true,
    );
  });
  it('normalizes translations when a native create resolves an existing identity', async () => {
    const f = fixture();
    f.state.existing = true;
    const { step } = await f.ready('roles', 'create', {
      key: 'manager',
      translates: [{ key: 'description', es: 'Detalle', en: 'Detail' }],
    });
    expect(
      (step.commandTemplate.command as NodiaAiJsonObject).translates,
    ).toHaveLength(2);
    expect(step.preconditions.translation_semantics).toBe('upsert-preview/1');
  });
  it('permits removing an unsaved translation from a genuinely new draft', async () => {
    const f = fixture(),
      { port, step } = await f.ready('roles', 'create', {
        key: 'new-role',
        translates: [{ key: 'name', es: 'Nuevo', en: 'New' }],
      });
    const template = await port.applyEdits(
      step.commandTemplate,
      [{ step_id: session, field_key: 'translates', value: [] }],
      f.ctx,
    );
    expect((template.command as NodiaAiJsonObject).translates).toEqual([]);
  });
});
