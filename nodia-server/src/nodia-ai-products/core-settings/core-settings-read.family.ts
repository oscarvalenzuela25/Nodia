import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { NodiaAiToolFamily } from '../../nodia-ai-tools/types/tool-registry.types.js';
import {
  ExecuteNodiaAiCoreSettingsReadUseCase,
  type NodiaAiCoreSettingsReadPorts,
  type CoreSettingsReadOperation,
  type CoreSettingsResource,
} from './use-case/execute-nodia-ai-core-settings-read.use-case.js';

export const NODIA_AI_CORE_SETTINGS_READ_FAMILY = Symbol(
  'NODIA_AI_CORE_SETTINGS_READ_FAMILY',
);
export const NODIA_AI_CORE_SETTINGS_READ_DEFINITIONS = Object.freeze([
  ['actions_get', 'actions', 'actions', 'actions', 'DetailInput', 'Action'],
  [
    'actions_list',
    'actions',
    'listActions',
    'actions',
    'ActionQuery',
    'ActionPage',
  ],
  [
    'business_actions_get',
    'business_actions',
    'businessActions',
    'actions',
    'DetailInput',
    'BusinessAction',
  ],
  [
    'business_actions_list',
    'business_actions',
    'listBusinessActions',
    'actions',
    'BusinessActionQuery',
    'BusinessActionPage',
  ],
  [
    'modules_get',
    'modules',
    'modules',
    'modules',
    'DetailInput',
    'ModuleDetail',
  ],
  [
    'modules_list',
    'modules',
    'listModules',
    'modules',
    'ModuleQuery',
    'ModulePage',
  ],
  [
    'module_groups_list',
    'module_groups',
    'listGroups',
    'modules',
    'GroupQuery',
    'GroupPage',
  ],
  ['roles_get', 'roles', 'roles', 'roles', 'DetailInput', 'RoleDetail'],
  ['roles_list', 'roles', 'listRoles', 'roles', 'RoleQuery', 'RolePage'],
  ['users_list', 'users', 'listUsers', 'users', 'UserQuery', 'UserPage'],
] as const satisfies ReadonlyArray<
  readonly [
    string,
    CoreSettingsResource,
    CoreSettingsReadOperation,
    string,
    string,
    string,
  ]
>);

/** Exports executable candidates; the root validates publication before composing them. */
export function createNodiaAiCoreSettingsReadFamily(
  ports: NodiaAiCoreSettingsReadPorts,
): NodiaAiToolFamily {
  const sourceJson = readFileSync(
    new URL('../contracts/core-settings.schema.json', import.meta.url),
    'utf8',
  );
  const sha256 = createHash('sha256').update(sourceJson, 'utf8').digest('hex');
  const reader = new ExecuteNodiaAiCoreSettingsReadUseCase(ports);
  return {
    familyKey: 'core_settings',
    modules: ['actions', 'modules', 'roles', 'users'].map((key) => ({
      key,
      route: `/settings/${key}`,
      label: key,
    })),
    resources: (
      [
        'actions',
        'business_actions',
        'modules',
        'module_groups',
        'roles',
        'users',
      ] as const
    ).map((key) => ({
      key,
      label: key,
      requiredModuleRoutes: [
        `/settings/${key === 'business_actions' ? 'actions' : key === 'module_groups' ? 'modules' : key}`,
      ],
    })),
    capabilities: NODIA_AI_CORE_SETTINGS_READ_DEFINITIONS.map(
      ([suffix, resource, operation, moduleKey, input, output]) => ({
        capabilityId: `nodia_${suffix}`,
        toolName: `nodia_${suffix}`,
        revision: 1,
        publication: 'published',
        kind: 'read',
        moduleKey,
        resourceKey: resource,
        operationKey: suffix,
        descriptionKey: `nodia_ai.core.${suffix}`,
        description: `Read Nodia settings ${suffix.replaceAll('_', ' ')}. List requests are paginated, active by default, and return explicit public fields. No credentials or authentication identifiers.`,
        requiredModuleRoutes: [`/settings/${moduleKey}`],
        actionKeys: [],
        effectKey: `core.read.${suffix}`,
        inputSchema: { sourceJson, definition: input, sha256 },
        outputSchema: { sourceJson, definition: output, sha256 },
        verifyAuthority: (input, context) =>
          reader.verifyAuthority(input, context),
        verifyResultAuthority: (input, result, context) =>
          reader.verifyResultAuthority(input, result, context),
        handler: (input, context) =>
          reader.execute(operation, resource, input, context),
      }),
    ),
  };
}
