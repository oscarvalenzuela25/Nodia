import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { BuildNodiaAiCoreOperationsUseCase } from '../../nodia-ai-core-operations/use-case/build-nodia-ai-core-operations.use-case.js';
import { BuildNodiaAiProviderOperationsUseCase } from '../../nodia-ai-provider-operations/use-case/build-nodia-ai-provider-operations.use-case.js';
import { BuildNodiaAiSecureOperationsUseCase } from '../../nodia-ai-secure-preparation/use-case/build-nodia-ai-secure-operations.use-case.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type {
  NodiaAiProposalPreparer,
  ProposalPreparerContext,
} from '../../nodia-ai-proposal/types/proposal-preparer.types.js';

interface Entry {
  tool_name: string;
  input_definition: string;
  resource_key: string;
  description: string;
}
const bundle = JSON.parse(
  readFileSync(
    new URL(
      '../../nodia-ai-products/contracts/write-core-provider.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  schema: NodiaAiJsonObject;
  tools: Entry[];
};
const sourceJson = JSON.stringify(bundle.schema);
const sha256 = createHash('sha256').update(sourceJson).digest('hex');
const validators = new Map(
  bundle.tools.map((entry) => [
    entry.tool_name,
    compileNodiaAiToolSchema({
      sourceJson,
      sha256,
      definition: entry.input_definition,
    }).validate,
  ]),
);

// Factories only assemble preparers. Any accidental access to a writer, DB or provider fails the test.
function forbiddenDependency<T>(): T {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('external dependency accessed by schema test');
      },
    },
  ) as T;
}
const core = new BuildNodiaAiCoreOperationsUseCase(
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
).operations;
const providers = new BuildNodiaAiProviderOperationsUseCase(
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
  forbiddenDependency(),
).operations;
const secure = new BuildNodiaAiSecureOperationsUseCase(
  forbiddenDependency(),
).operations.filter(
  (entry) => !entry.toolName.startsWith('nodia_secure_flows_'),
);
const preparers = new Map<string, NodiaAiProposalPreparer>(
  [...core, ...providers, ...secure].map((entry) => [entry.toolName, entry]),
);
const unauthorizedContext = {
  manager: { queryRunner: { isTransactionActive: false } },
  moduleRoutes: [],
} as unknown as ProposalPreparerContext;
const translation = { key: 'label', es: 'Etiqueta', en: 'Label' };
const coreFields: Record<string, NodiaAiJsonObject> = {
  users: {
    email: 'person@example.test',
    name: null,
    image_url: null,
    is_active: false,
    roles: ['1'],
    modules: [],
  },
  roles: {
    key: 'operator',
    is_active: false,
    actions: ['ai:manage', '2'],
    translates: [translation],
  },
  actions: {
    key: 'read',
    description: null,
    is_active: false,
    translates: [translation],
  },
  business_actions: {
    key: 'receive',
    has_description: false,
    is_active: false,
    translates: [translation],
  },
  modules: {
    key: 'example',
    module_group_id: '2',
    link: '/tools/example',
    icon: null,
    is_active: false,
    translates: [translation],
  },
  module_groups: {
    key: 'example',
    icon: null,
    is_active: false,
    translates: [translation],
  },
};
function complete(entry: Entry): NodiaAiJsonObject {
  const action = entry.tool_name.split('_').at(-1);
  if (entry.tool_name === 'nodia_api_keys_prepare_delete')
    return { provider_id: '1', key_id: '2' };
  if (entry.tool_name.endsWith('_logout')) return { provider_id: '1' };
  if (entry.tool_name.endsWith('_sync_models'))
    return { provider_id: '1', mode: 'agentic' };
  if (entry.resource_key === 'ai_providers')
    return {
      ...(action === 'create'
        ? { catalog_id: '1' }
        : {
            id: '1',
            'agentic.selected_model': 'synthetic-discovered-model',
            'agentic.ocr_model': null,
            'api_key.thinking_level': null,
          }),
      name: 'Conexión de prueba',
      use_api_key: false,
      use_agentic: true,
      default_mode: null,
      auto_rotate_api_keys: false,
      is_default: false,
      is_active: false,
      translates: [translation],
    };
  if (entry.resource_key === 'ai_provider_catalog')
    return {
      ...(action === 'create'
        ? { key: 'synthetic-provider' }
        : { id: '1', is_active: false }),
      name: 'Synthetic provider',
      can_use_api_key: false,
      can_use_agentic: false,
    };
  return {
    ...(action === 'create' ? {} : { id: '1' }),
    ...(action === 'delete' ? {} : coreFields[entry.resource_key]),
  };
}
function validate(name: string, payload: unknown): boolean {
  const validator = validators.get(name);
  expect(validator, name).toBeDefined();
  return validator!(payload);
}
async function nativeStatus(
  name: string,
  payload: NodiaAiJsonObject,
): Promise<number> {
  try {
    await preparers.get(name)!.prepare(payload, unauthorizedContext);
    throw new Error('Preparation unexpectedly bypassed authority');
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return error.getStatus();
  }
}

describe('Core/provider MCP write contracts use real preparation decoders', () => {
  it('covers precisely the 24 native preparers, excluding four secure credential/login flows', () => {
    expect(bundle.tools).toHaveLength(24);
    expect([...validators.keys()].sort()).toEqual([...preparers.keys()].sort());
    expect(
      new Set(bundle.tools.map((entry) => entry.input_definition)).size,
    ).toBe(24);
    expect(
      bundle.tools.every((entry) => /[Pp]repara/u.test(entry.description)),
    ).toBe(true);
  });
  it('declares every editable native field and only its supported target identities', () => {
    for (const entry of bundle.tools) {
      const preparer = preparers.get(entry.tool_name)!;
      const definitions = bundle.schema.$defs as NodiaAiJsonObject;
      const definition = definitions[
        entry.input_definition
      ] as NodiaAiJsonObject;
      const properties = definition.properties as NodiaAiJsonObject;
      const identities =
        entry.tool_name === 'nodia_api_keys_prepare_delete'
          ? ['provider_id', 'key_id']
          : entry.tool_name.endsWith('_logout')
            ? ['provider_id']
            : entry.tool_name.endsWith('_sync_models')
              ? ['provider_id', 'mode']
              : entry.tool_name === 'nodia_ai_providers_prepare_create'
                ? ['catalog_id']
                : entry.tool_name.endsWith('_create')
                  ? []
                  : ['id'];
      expect(Object.keys(properties).sort(), entry.tool_name).toEqual(
        [
          ...new Set([...Object.keys(preparer.editableFields), ...identities]),
        ].sort(),
      );
    }
  });
  for (const entry of bundle.tools) {
    describe(entry.tool_name, () => {
      it('accepts a partial command and reaches native authority without invoking dependencies', async () => {
        expect(validate(entry.tool_name, {})).toBe(true);
        expect(await nativeStatus(entry.tool_name, {})).toBe(403);
        const input = complete(entry);
        const before = structuredClone(input);
        expect(validate(entry.tool_name, input)).toBe(true);
        expect(input).toEqual(before);
        expect(await nativeStatus(entry.tool_name, input)).toBe(403);
      });
      it('rejects actor, persisted templates, confirmation and credential injection', async () => {
        for (const [key, value] of Object.entries({
          actor_id: '1',
          user_id: '1',
          session_id: 'synthetic',
          schema_version: 1,
          command: {},
          origins: {},
          confirmed: true,
          approval: {},
          secret: 'synthetic-secret',
          api_key: 'synthetic-secret',
          access_token: 'synthetic-token',
          credentials: {},
        })) {
          const input = { ...complete(entry), [key]: value };
          expect(validate(entry.tool_name, input), key).toBe(false);
          expect(await nativeStatus(entry.tool_name, input), key).toBe(400);
        }
      });
      it('requires plain objects without coercion and rejects null, arrays and scalar commands', () => {
        for (const input of [null, [], '1', 1, true])
          expect(validate(entry.tool_name, input)).toBe(false);
      });
      it('preserves bigint string precision and rejects zero, overflow and numeric identities', async () => {
        const properties = (bundle.schema.$defs as NodiaAiJsonObject)[
          entry.input_definition
        ] as NodiaAiJsonObject;
        const inputProperties = properties.properties as NodiaAiJsonObject;
        const idFields = Object.keys(inputProperties).filter((key) =>
          [
            'id',
            'provider_id',
            'key_id',
            'catalog_id',
            'module_group_id',
          ].includes(key),
        );
        if (!idFields.length) {
          expect(validate(entry.tool_name, { id: '1' })).toBe(false);
          return;
        }
        for (const key of idFields) {
          for (const value of [
            '1',
            '9007199254740993',
            '9223372036854775807',
          ]) {
            expect(
              validate(entry.tool_name, { [key]: value }),
              `${key}=${value}`,
            ).toBe(true);
            expect(await nativeStatus(entry.tool_name, { [key]: value })).toBe(
              403,
            );
          }
          for (const value of [
            '0',
            '-1',
            '01',
            '9223372036854775808',
            '9999999999999999999',
            '1.0',
            1,
            null,
          ]) {
            expect(
              validate(entry.tool_name, { [key]: value }),
              `${key}=${String(value)}`,
            ).toBe(false);
            expect(
              await nativeStatus(entry.tool_name, { [key]: value }),
              key,
            ).toBe(400);
          }
        }
      });
    });
  }
  it('closes nested translations and enforces native 100-entry association/translation bounds', () => {
    for (const name of [
      'nodia_roles_prepare_create',
      'nodia_ai_providers_prepare_update',
    ]) {
      expect(
        validate(name, {
          translates: [{ ...translation, secret: 'synthetic' }],
        }),
      ).toBe(false);
      expect(
        validate(name, { translates: [{ key: 'label', es: 'Etiqueta' }] }),
      ).toBe(false);
      expect(
        validate(name, { translates: [{ ...translation, en: null }] }),
      ).toBe(false);
      expect(validate(name, { translates: [] })).toBe(true);
      expect(
        validate(name, {
          translates: Array.from({ length: 101 }, (_, index) => ({
            ...translation,
            key: `label-${index}`,
          })),
        }),
      ).toBe(false);
    }
    expect(
      validate('nodia_users_prepare_update', {
        roles: Array.from({ length: 101 }, (_, index) => String(index + 1)),
      }),
    ).toBe(false);
    expect(validate('nodia_users_prepare_update', { roles: [1] })).toBe(false);
    expect(
      validate('nodia_roles_prepare_update', {
        actions: ['9223372036854775808'],
      }),
    ).toBe(false);
    expect(
      validate('nodia_roles_prepare_update', {
        actions: ['ai:manage', '9223372036854775807'],
      }),
    ).toBe(true);
  });
  it('keeps model IDs dynamic but configuration closed, nullable and separate per channel', () => {
    const name = 'nodia_ai_providers_prepare_update';
    for (const mode of ['api_key', 'agentic', 'agentic']) {
      for (const key of [
        'selected_model',
        'ocr_model',
        'ocr_focus_model',
        'thinking_level',
      ]) {
        expect(
          validate(name, { [`${mode}.${key}`]: 'future-discovered-value' }),
        ).toBe(true);
        expect(validate(name, { [`${mode}.${key}`]: null })).toBe(true);
        expect(validate(name, { [`${mode}.${key}`]: '  ' })).toBe(false);
        expect(
          validate(name, { [`${mode}.${key}`]: { secret: 'synthetic' } }),
        ).toBe(false);
        expect(
          validate('nodia_ai_providers_prepare_create', {
            [`${mode}.${key}`]: 'future-discovered-value',
          }),
        ).toBe(false);
      }
    }
    for (const input of [
      { fields: {} },
      { api_key: {} },
      { 'api_key.thinking_levels': {} },
      { selected_model: 'synthetic' },
      { available_models: [] },
      { health_state: 'available' },
      { default_mode: 'unregistered-mode' },
    ])
      expect(validate(name, input)).toBe(false);
  });
  it('retains native semantic and UTF-8 validation after the bounded structural schema', async () => {
    const name = 'nodia_ai_providers_prepare_update';
    const duplicateTranslations = {
      translates: [translation, { ...translation }],
    };
    expect(validate(name, duplicateTranslations)).toBe(true);
    expect(await nativeStatus(name, duplicateTranslations)).toBe(400);
    const utf8Oversize = { name: 'á'.repeat(100) };
    expect(validate(name, utf8Oversize)).toBe(true);
    expect(await nativeStatus(name, utf8Oversize)).toBe(400);
    expect(
      await nativeStatus('nodia_users_prepare_create', {
        email: 'not-an-email',
      }),
    ).toBe(400);
    const normalizableEmail = { email: '  PERSON@EXAMPLE.TEST  ' };
    expect(validate('nodia_users_prepare_create', normalizableEmail)).toBe(
      true,
    );
    expect(
      await nativeStatus('nodia_users_prepare_create', normalizableEmail),
    ).toBe(403);
    expect(
      validate('nodia_users_prepare_update', {
        name: null,
        image_url: null,
        is_active: false,
        roles: [],
        modules: [],
      }),
    ).toBe(true);
    expect(validate('nodia_users_prepare_update', { email: null })).toBe(false);
  });
});
