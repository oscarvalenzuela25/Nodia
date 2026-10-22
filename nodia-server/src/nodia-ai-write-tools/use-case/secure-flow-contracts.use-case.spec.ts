import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { HttpException } from '@nestjs/common';
import { validateSync } from 'class-validator';
import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { CreateAiApiKeyDto } from '../../ai-provider/dto/create-ai-api-key.dto.js';
import { UpdateAiApiKeyDto } from '../../ai-provider/dto/update-ai-api-key.dto.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { ProposalPreparerContext } from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import {
  nodiaAiSecureOperationIdentity,
  type NodiaAiSecureFlowKind,
} from '../../nodia-ai-proposal/types/secure-operation.types.js';
import { NodiaAiSecurePreparationService } from '../../nodia-ai-secure-preparation/nodia-ai-secure-preparation.service.js';
import { BuildNodiaAiSecureOperationsUseCase } from '../../nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { WriteContractBundle } from '../types/write-tool-contract.types.js';

const bundle = JSON.parse(
  readFileSync(
    new URL(
      '../../nodia-ai-products/contracts/secure-flows.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as WriteContractBundle;
const sourceJson = JSON.stringify(bundle.schema);
const sha256 = createHash('sha256').update(sourceJson).digest('hex');
const validators = new Map(
  bundle.tools.map((tool) => [
    tool.tool_name,
    compileNodiaAiToolSchema({
      sourceJson,
      sha256,
      definition: tool.input_definition,
    }).validate,
  ]),
);
const name = (kind: string) => `nodia_secure_flows_prepare_${kind}`;
const nativeKinds = [
  'api_key_create',
  'api_key_update',
  'connection_login',
  'nodia_logout',
] as const;
function valid(kind: string, input: unknown): boolean {
  const validator = validators.get(name(kind));
  if (!validator) throw Error('missing secure schema fixture');
  return validator(input);
}

/** Native preparation only. SQL authority and safe metadata are synthetic; no provider/channel is invoked. */
function fixture() {
  const provider: NodiaAiJsonObject = {
    id: '2',
    name: 'Synthetic secure connection',
    provider_key: 'gemini',
    is_active: true,
    catalog_active: true,
    use_api_key: true,
    use_token_plan_web: true,
    use_token_plan_agentic: true,
    can_use_api_key: true,
    can_use_token_plan_web: true,
    can_use_token_plan_agentic: true,
  };
  const pool: NodiaAiJsonObject[] = [
    {
      id: '3',
      provider_id: '2',
      label: 'Synthetic existing label',
      sort_order: 1,
      is_selected: true,
      is_active: true,
      updated_at: 'synthetic-revision',
    },
  ];
  const store = {
    provider: vi.fn(async () => structuredClone(provider)),
    keys: vi.fn(async () => structuredClone(pool)),
  } as unknown as NodiaAiSecurePreparationService;
  const query = vi.fn(async (sql: string, _parameters?: unknown[]) => {
    if (sql.includes('AS "actorId"'))
      return [
        {
          actorId: '1',
          sessionId: '00000000-0000-4000-8000-000000000001',
          isSuperAdmin: false,
        },
      ];
    if (sql.includes(' AS module')) return [{ module: true, action: true }];
    return [];
  });
  const context: ProposalPreparerContext = {
    manager: {
      query,
      queryRunner: { isTransactionActive: true },
    } as unknown as EntityManager,
    actor: {
      actorId: '1',
      sessionId: '00000000-0000-4000-8000-000000000001',
      isSuperAdmin: false,
      modules: [],
    },
    moduleRoutes: ['/tools/nodia-ai', '/settings/ai-providers'],
    conversationId: '00000000-0000-4000-8000-000000000002',
  };
  const operations = new BuildNodiaAiSecureOperationsUseCase(store).operations;
  function port(kind: NodiaAiSecureFlowKind) {
    const result = operations.find((operation) => operation.kind === kind);
    if (!result) throw Error('missing native secure fixture');
    return result;
  }
  return { provider, pool, store, query, context, operations, port };
}
function complete(kind: string): NodiaAiJsonObject {
  if (kind === 'nodia_logout') return {};
  if (kind === 'connection_login')
    return { provider_id: '2', mode: 'token_plan_web' };
  return {
    provider_id: '2',
    ...(kind === 'api_key_update' ? { key_id: '3' } : {}),
    label: 'Synthetic label',
    sort_order: 0,
    is_selected: false,
    is_active: false,
  };
}

describe('AI36-C02 closed secure preparation contracts', () => {
  it('maps exactly four native secure entry points without publishing ordinary C01 effects', () => {
    expect(bundle.tools).toHaveLength(4);
    expect(bundle.tools.map((tool) => tool.tool_name).sort()).toEqual(
      nativeKinds.map(name).sort(),
    );
    const f = fixture();
    const definitions = bundle.schema.$defs as NodiaAiJsonObject;
    for (const tool of bundle.tools) {
      expect(tool.kind).toBe('prepare_secure_flow');
      expect(tool.resource_key).toBe(
        tool.tool_name === name('nodia_logout')
          ? 'nodia_sessions'
          : 'secure_flows',
      );
      const identity = nodiaAiSecureOperationIdentity(tool.tool_name);
      expect(identity).not.toBeNull();
      if (!identity) throw Error('native identity missing');
      const native = f.port(identity.kind);
      const definition = definitions[
        tool.input_definition
      ] as NodiaAiJsonObject;
      expect(definition.additionalProperties).toBe(false);
      expect(
        Object.keys(definition.properties as NodiaAiJsonObject).sort(),
      ).toEqual(
        [
          ...Object.keys(native.editableFields),
          ...(identity.providerRequired ? ['provider_id'] : []),
          ...(identity.keyRequired ? ['key_id'] : []),
          ...(identity.modeRequired ? ['mode'] : []),
        ].sort(),
      );
      expect(native.moduleRoutes).toEqual(
        identity.providerRequired ? ['/settings/ai-providers'] : [],
      );
      expect(native.actionKeys).toEqual(
        identity.providerRequired ? ['ai:manage'] : [],
      );
      expect(native.bindableFields).toEqual({});
      expect(native.outputKeys).toEqual({});
      expect(native).not.toHaveProperty('executeConfirmed');
    }
  });

  for (const kind of nativeKinds) {
    describe(kind, () => {
      it('allows only public partial input and preserves native minimal clarification', async () => {
        const f = fixture();
        expect(valid(kind, {})).toBe(true);
        const result = await f.port(kind).prepare({}, f.context);
        if (kind === 'nodia_logout') {
          expect(result.status).toBe('ready');
          expect(f.store.provider).not.toHaveBeenCalled();
          expect(f.store.keys).not.toHaveBeenCalled();
          return;
        }
        expect(result.status).toBe('needs_clarification');
        if (result.status !== 'needs_clarification')
          throw Error('unexpected readiness');
        expect(result.missingFields).toEqual(
          kind === 'api_key_create'
            ? ['provider_id', 'label']
            : kind === 'api_key_update'
              ? ['provider_id', 'key_id']
              : ['provider_id', 'mode'],
        );
        expect(f.store.provider).not.toHaveBeenCalled();
        expect(f.store.keys).not.toHaveBeenCalled();
        expect(JSON.stringify(result)).not.toMatch(
          /secret|oauth|cookie|password|authorization/i,
        );
      });

      it('compiles a complete native preview without executing or requesting credentials', async () => {
        const f = fixture();
        const input = complete(kind),
          before = structuredClone(input);
        expect(valid(kind, input)).toBe(true);
        const result = await f.port(kind).prepare(input, f.context);
        expect(input).toEqual(before);
        expect(result.status).toBe('ready');
        if (result.status !== 'ready') throw Error('unexpected clarification');
        expect(result.publicStep.kind).toBe('secure_flow');
        expect(result.publicStep.tool_name).toBe(name(kind));
        expect(result.publicStep.effect_key).toBe(`secure_flows.${kind}`);
        expect(result.publicStep.depends_on).toEqual([]);
        expect(result.publicStep.output_bindings).toEqual([]);
        expect(result.scope).toEqual({});
        expect(JSON.stringify(result)).not.toMatch(
          /secret|oauth|cookie|password|authorization|https?:\/\//i,
        );
      });

      it('rejects credentials, session substitution, trusted templates and execution payloads before lookup', async () => {
        const f = fixture();
        for (const [key, value] of Object.entries({
          secret: 'synthetic-marker',
          api_key: 'synthetic-marker',
          access_token: 'synthetic-marker',
          cookie: 'synthetic-marker',
          password: 'synthetic-marker',
          code: 'synthetic-marker',
          device_code: 'synthetic-marker',
          oauth_code: 'synthetic-marker',
          authorization: 'synthetic-marker',
          url: 'https://example.invalid',
          login_url: 'https://example.invalid',
          native_reference: 'synthetic-marker',
          native_request: {},
          actor_id: '1',
          user_id: '1',
          session_id: '00000000-0000-4000-8000-000000000001',
          confirmed: true,
          command: {},
          schema_version: 1,
          origins: {},
          health_state: 'available',
          last_error_message: 'synthetic-marker',
          fields: {},
        })) {
          const input = { ...complete(kind), [key]: value };
          expect(valid(kind, input), key).toBe(false);
          await expect(
            f.port(kind).prepare(input, f.context),
            key,
          ).rejects.toThrow('nodia_ai:invalid_input');
        }
        expect(f.store.provider).not.toHaveBeenCalled();
        expect(f.store.keys).not.toHaveBeenCalled();
      });

      it('rejects null, arrays and scalar partials without coercion', () => {
        for (const input of [null, [], '', true, 0])
          expect(valid(kind, input)).toBe(false);
      });

      it('retains native transaction authority even when the structure is valid', async () => {
        const f = fixture();
        const inactive = {
          ...f.context,
          manager: {
            queryRunner: { isTransactionActive: false },
          } as EntityManager,
        };
        await expect(
          f.port(kind).prepare(complete(kind), inactive),
        ).rejects.toThrow('authorization:transaction_required');
        expect(f.store.provider).not.toHaveBeenCalled();
      });
    });
  }

  it.each(['api_key_create', 'api_key_update', 'connection_login'] as const)(
    '%s preserves exact positive int64 string identities',
    async (kind) => {
      const f = fixture();
      const fields =
        kind === 'api_key_update' ? ['provider_id', 'key_id'] : ['provider_id'];
      for (const key of fields) {
        for (const value of ['1', '9007199254740993', '9223372036854775807']) {
          const input = { [key]: value };
          expect(valid(kind, input), `${key}=${value}`).toBe(true);
          const result = await f.port(kind).prepare(input, f.context);
          expect(result.status).toBe('needs_clarification');
          if (result.status !== 'needs_clarification')
            throw Error('unexpected readiness');
          expect(result.partial[key]).toBe(value);
        }
        for (const value of [
          '0',
          '-1',
          '01',
          '1.0',
          '1e2',
          '9223372036854775808',
          '9999999999999999999',
          1,
          null,
        ]) {
          const input = { [key]: value };
          expect(valid(kind, input), `${key}=${String(value)}`).toBe(false);
          await expect(f.port(kind).prepare(input, f.context)).rejects.toThrow(
            'nodia_ai:invalid_input',
          );
        }
      }
    },
  );

  it.each(['api_key_create', 'api_key_update'] as const)(
    '%s bounds the same nonsecret metadata accepted by native DTOs',
    async (kind) => {
      const f = fixture();
      for (const metadata of [
        {
          label: 'x'.repeat(100),
          sort_order: 1000000,
          is_selected: false,
          is_active: false,
        },
        { label: ' x ', sort_order: 0, is_selected: false, is_active: true },
      ]) {
        const input = { ...complete(kind), ...metadata };
        expect(valid(kind, input)).toBe(true);
        const dto =
          kind === 'api_key_create'
            ? Object.assign(new CreateAiApiKeyDto(), {
                ...input,
                secret: 'synthetic-unit-only-secret',
              })
            : Object.assign(new UpdateAiApiKeyDto(), metadata);
        expect(validateSync(dto)).toEqual([]);
        expect((await f.port(kind).prepare(input, f.context)).status).toBe(
          'ready',
        );
      }
      const invalidMetadata: NodiaAiJsonObject[] = [
        { label: '' },
        { label: '   ' },
        { label: 'x'.repeat(101) },
        { label: null },
        { sort_order: -1 },
        { sort_order: 1000001 },
        { sort_order: 0.5 },
        { sort_order: '1' },
        { is_active: 'true' },
        { is_active: null },
        { is_selected: 1 },
        { is_selected: null },
      ];
      for (const bad of invalidMetadata) {
        const input = { ...complete(kind), ...bad };
        expect(valid(kind, input), JSON.stringify(bad)).toBe(false);
        await expect(f.port(kind).prepare(input, f.context)).rejects.toThrow(
          'nodia_ai:invalid_input',
        );
      }
    },
  );

  it('preserves the final native UTF-16 and selection checks after structural validation', async () => {
    const f = fixture();
    const astralLabel = { provider_id: '2', label: '😀'.repeat(60) };
    expect(valid('api_key_create', astralLabel)).toBe(true);
    await expect(
      f.port('api_key_create').prepare(astralLabel, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
    const inactiveSelection = {
      provider_id: '2',
      label: 'x',
      is_active: false,
      is_selected: true,
    };
    expect(valid('api_key_create', inactiveSelection)).toBe(true);
    await expect(
      f.port('api_key_create').prepare(inactiveSelection, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
  });

  it('permits only Web or Agentic for login and keeps provider-specific availability native', async () => {
    const f = fixture();
    for (const mode of ['token_plan_web', 'token_plan_agentic']) {
      const input = { provider_id: '2', mode };
      expect(valid('connection_login', input)).toBe(true);
      expect(
        (await f.port('connection_login').prepare(input, f.context)).status,
      ).toBe('ready');
    }
    for (const mode of ['api_key', 'web', 'agentic', '', null, 0]) {
      const input = { provider_id: '2', mode };
      expect(valid('connection_login', input)).toBe(false);
      await expect(
        f.port('connection_login').prepare(input, f.context),
      ).rejects.toThrow('nodia_ai:invalid_input');
    }
    f.provider.provider_key = 'openai';
    const web = { provider_id: '2', mode: 'token_plan_web' };
    expect(valid('connection_login', web)).toBe(true);
    await expect(
      f.port('connection_login').prepare(web, f.context),
    ).rejects.toThrow('nodia_ai:invalid_input');
    const agentic = { provider_id: '2', mode: 'token_plan_agentic' };
    expect(
      (await f.port('connection_login').prepare(agentic, f.context)).status,
    ).toBe('ready');
    f.provider.use_token_plan_agentic = false;
    await expect(
      f.port('connection_login').prepare(agentic, f.context),
    ).rejects.toThrow('nodia_ai:capability_unavailable');
  });

  it.each(['api_key_create', 'api_key_update', 'connection_login'] as const)(
    '%s continues native partials while refusing changes to fixed identity',
    async (kind) => {
      const f = fixture();
      const initial = await f.port(kind).prepare({}, f.context);
      if (initial.status !== 'needs_clarification')
        throw Error('unexpected readiness');
      const full = complete(kind);
      const ready = await f
        .port(kind)
        .prepare(full, f.context, initial.partial);
      expect(ready.status).toBe('ready');
      if (ready.status !== 'ready') throw Error('unexpected clarification');
      expect(
        (await f.port(kind).prepare({}, f.context, ready.commandTemplate))
          .status,
      ).toBe('ready');
      for (const key of kind === 'api_key_update'
        ? ['provider_id', 'key_id']
        : ['provider_id']) {
        await expect(
          f
            .port(kind)
            .prepare({ [key]: '99' }, f.context, ready.commandTemplate),
        ).rejects.toThrow('nodia_ai:invalid_input');
      }
      if (kind === 'connection_login')
        await expect(
          f
            .port(kind)
            .prepare(
              { mode: 'token_plan_agentic' },
              f.context,
              ready.commandTemplate,
            ),
        ).rejects.toThrow('nodia_ai:invalid_input');
    },
  );

  it('binds own-session logout exclusively to trusted context with no destination module dependency', async () => {
    const f = fixture();
    const p = f.port('nodia_logout');
    expect(valid('nodia_logout', {})).toBe(true);
    const result = await p.prepare(
      {},
      { ...f.context, moduleRoutes: ['/tools/nodia-ai'] },
    );
    expect(result.status).toBe('ready');
    expect(f.store.provider).not.toHaveBeenCalled();
    expect(f.store.keys).not.toHaveBeenCalled();
    expect(p.moduleRoutes).toEqual([]);
    expect(p.actionKeys).toEqual([]);
    const authorizationCall = f.query.mock.calls.find(([sql]) =>
      sql.includes(' AS module'),
    );
    expect(authorizationCall).toBeDefined();
    // This asserts the actual native policy query only asks for NodiaAI, not provider administration.
    expect(authorizationCall?.[1]?.[1]).toEqual(['/tools/nodia-ai']);
    expect(JSON.stringify(result)).not.toContain('session_id');
    const invalidIdentities: NodiaAiJsonObject[] = [
      { provider_id: '2' },
      { key_id: '3' },
      { mode: 'token_plan_web' },
      { actor_id: '9' },
    ];
    for (const payload of invalidIdentities) {
      expect(valid('nodia_logout', payload)).toBe(false);
      await expect(p.prepare(payload, f.context)).rejects.toBeInstanceOf(
        HttpException,
      );
    }
  });
});
