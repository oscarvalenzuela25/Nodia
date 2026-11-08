import { Inject, Injectable } from '@nestjs/common';
import { canonicalModuleRoute, canonicalModuleRoutes, contractModuleRoute, moduleRouteIncluded } from '../../authorization/canonical-module-route.js';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { ValidateFunction } from 'ajv';
import { parseNodiaAiStrictJson } from '../../nodia-ai-context/strict-json.js';
import type { KnowledgeRequirement } from '../../nodia-ai-context/types/knowledge.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import {
  NODIA_AI_TOOL_FAMILIES,
  NODIA_AI_CAPABILITIES_CATALOG_VERSION,
  type NodiaAiToolFamily,
  type NodiaAiToolSchemaReference,
  type NodiaAiRegisteredTool,
  type NodiaAiToolModuleRegistration,
  type NodiaAiToolResourceRegistration,
} from '../types/tool-registry.types.js';

const invalid = (): never => {
  throw new Error('nodia_ai:tool_registry_invalid');
};
const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function jsonObject(value: unknown): value is NodiaAiJsonObject {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}
function key(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9_.-]{0,127}$/.test(value);
}
function routes(value: readonly string[]): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 16 &&
    new Set(canonicalModuleRoutes(value)).size === value.length &&
    value.every(
      (route) =>
        typeof route === 'string' &&
        /^\/(?:[a-z][a-z0-9_-]*|(?:settings|tools)\/[a-z][a-z0-9_-]*)$/.test(route) &&
        route.length <= 128,
    )
  );
}

/** Compiles only a supplied document; Ajv has no network loader, coercion, defaults or mutation. */
export function compileNodiaAiToolSchema(
  reference: NodiaAiToolSchemaReference,
): {
  readonly validate: ValidateFunction;
  readonly schema: Readonly<NodiaAiJsonObject>;
  readonly ref: string;
} {
  try {
    if (
      !reference ||
      typeof reference.sourceJson !== 'string' ||
      Buffer.byteLength(reference.sourceJson, 'utf8') > 4 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(reference.sha256) ||
      hash(reference.sourceJson) !== reference.sha256 ||
      !/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(reference.definition)
    )
      return invalid();
    // Ajv's uniqueItems comparator requires ordinary JSON objects; strict parsing still rejects duplicate keys first.
    const document: unknown = structuredClone(
      parseNodiaAiStrictJson(reference.sourceJson),
    );
    if (
      !jsonObject(document) ||
      typeof document.$id !== 'string' ||
      !jsonObject(document.$defs)
    )
      return invalid();
    const documentId = document.$id;
    const documentDefinitions = document.$defs;
    const schema = documentDefinitions[reference.definition];
    if (
      !jsonObject(schema) ||
      schema.type !== 'object' ||
      schema.additionalProperties !== false
    )
      return invalid();
    // Inspect reachable schemas only; unrelated definitions do not grant tools or schema access.
    const visited = { closed: new Set<object>(), partial: new Set<object>() };
    const definitions = new Set<string>([reference.definition]);
    const inspect = (node: unknown, partial = false): void => {
      if (Array.isArray(node)) {
        for (const child of node) inspect(child, partial);
        return;
      }
      if (!jsonObject(node)) return;
      const seen = partial ? visited.partial : visited.closed;
      if (seen.has(node)) return;
      seen.add(node);
      if (
        (node.type === 'object' ||
          (!partial && node.properties !== undefined)) &&
        node.additionalProperties !== false
      )
        invalid();
      if (typeof node.$ref === 'string') {
        const pointer = node.$ref.startsWith(`${documentId}#/`)
          ? node.$ref.slice(documentId.length)
          : node.$ref;
        if (!pointer.startsWith('#/$defs/')) invalid();
        definitions.add(
          pointer
            .slice('#/$defs/'.length)
            .split('/')[0]
            .replaceAll('~1', '/')
            .replaceAll('~0', '~'),
        );
        let target: unknown = document;
        for (const part of pointer
          .slice(2)
          .split('/')
          .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
          if (!jsonObject(target) || !Object.hasOwn(target, part)) invalid();
          target = (target as NodiaAiJsonObject)[part];
        }
        inspect(target, partial);
      }
      for (const name of [
        'properties',
        'patternProperties',
        '$defs',
        'dependentSchemas',
      ])
        if (jsonObject(node[name]))
          for (const child of Object.values(node[name])) inspect(child);
      for (const name of [
        'items',
        'prefixItems',
        'contains',
        'propertyNames',
        'unevaluatedProperties',
      ])
        if (node[name] !== undefined) inspect(node[name]);
      for (const name of [
        'allOf',
        'anyOf',
        'oneOf',
        'not',
        'if',
        'then',
        'else',
      ])
        if (node[name] !== undefined)
          inspect(node[name], partial || node.additionalProperties === false);
    };
    inspect(schema);
    const ajv = new Ajv2020({
      strict: true,
      allErrors: true,
      coerceTypes: false,
      useDefaults: false,
      removeAdditional: false,
    });
    const addFormats = createRequire(import.meta.url)('ajv-formats') as (
      instance: Ajv2020,
    ) => void;
    addFormats(ajv);
    ajv.addSchema(document);
    const ref = `${documentId}#/$defs/${reference.definition}`;
    const validate = ajv.getSchema(ref);
    if (!validate) return invalid();
    const exposed: NodiaAiJsonObject = {
      ...structuredClone(schema),
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: documentId,
    };
    if (definitions.size)
      exposed.$defs = Object.fromEntries(
        [...definitions]
          .sort()
          .map((name) => [name, structuredClone(documentDefinitions[name])]),
      );
    return { validate, schema: freeze(exposed), ref };
  } catch {
    return invalid();
  }
}

/** Explicit composition only: no filesystem discovery, controllers, SQL, or handler invocation at registration. */
@Injectable()
export class NodiaAiToolRegistryUseCase {
  private readonly tools = new Map<string, NodiaAiRegisteredTool>();
  private readonly byId = new Map<string, NodiaAiRegisteredTool>();
  private readonly validators = new Map<
    string,
    { input: ValidateFunction; output: ValidateFunction }
  >();
  private readonly moduleEntries: readonly NodiaAiToolModuleRegistration[];
  private readonly resourceEntries: readonly NodiaAiToolResourceRegistration[];
  constructor(
    @Inject(NODIA_AI_TOOL_FAMILIES) families: readonly NodiaAiToolFamily[],
    @Inject(NODIA_AI_CAPABILITIES_CATALOG_VERSION)
    readonly catalogVersion: string,
  ) {
    if (
      !Array.isArray(families) ||
      families.length > 256 ||
      typeof catalogVersion !== 'string' ||
      !catalogVersion.trim() ||
      [...catalogVersion].length > 128
    )
      invalid();
    const familyKeys = new Set<string>(),
      modules = new Map<string, NodiaAiToolModuleRegistration>(),
      resources = new Map<string, NodiaAiToolResourceRegistration>();
    for (const family of families) {
      if (
        !family ||
        !key(family.familyKey) ||
        familyKeys.has(family.familyKey) ||
        !Array.isArray(family.modules) ||
        !Array.isArray(family.resources) ||
        !Array.isArray(family.capabilities) ||
        family.capabilities.length > 512
      )
        invalid();
      familyKeys.add(family.familyKey);
      const localModules = new Set<string>(),
        localResources = new Set<string>();
      for (const module of family.modules) {
        if (
          !key(module.key) ||
          !routes([module.route]) ||
          typeof module.label !== 'string' ||
          !module.label.trim() ||
          localModules.has(module.key)
        )
          invalid();
        const prior = modules.get(module.key);
        if (
          (prior && canonical({ ...prior, route: canonicalModuleRoute(prior.route) }) !== canonical({ ...module, route: canonicalModuleRoute(module.route) })) ||
          [...modules.values()].some(
            (item) => canonicalModuleRoute(item.route) === canonicalModuleRoute(module.route) && item.key !== module.key,
          )
        )
          invalid();
        modules.set(module.key, freeze(structuredClone(module)));
        localModules.add(module.key);
      }
      for (const resource of family.resources) {
        if (
          !key(resource.key) ||
          typeof resource.label !== 'string' ||
          !resource.label.trim() ||
          !routes(resource.requiredModuleRoutes) ||
          resource.requiredModuleRoutes.some(
            (route) => !family.modules.some((module) => canonicalModuleRoute(module.route) === canonicalModuleRoute(route)),
          ) ||
          resources.has(resource.key)
        )
          invalid();
        resources.set(resource.key, freeze(structuredClone(resource)));
        localResources.add(resource.key);
      }
      for (const item of family.capabilities) {
        if (
          !item ||
          typeof item.capabilityId !== 'string' ||
          !/^[a-z][a-z0-9_]{0,127}$/.test(item.capabilityId) ||
          typeof item.toolName !== 'string' ||
          !/^nodia_[a-z0-9_]{1,120}$/.test(item.toolName) ||
          !Number.isSafeInteger(item.revision) ||
          item.revision < 1 ||
          item.revision > 2147483647 ||
          item.publication !== 'published' ||
          ![
            'read',
            'prepare_change',
            'read_artifact',
            'analyze_attachment',
            'prepare_secure_flow',
            'prepare_workflow',
            'prepare_preference_change',
          ].includes(item.kind) ||
          !localModules.has(item.moduleKey) ||
          !localResources.has(item.resourceKey) ||
          !key(item.operationKey) ||
          typeof item.descriptionKey !== 'string' ||
          !/^[a-z][a-z0-9_.:-]{0,127}$/.test(item.descriptionKey) ||
          typeof item.effectKey !== 'string' ||
          !/^[a-z][a-z0-9_.:-]{0,127}$/.test(item.effectKey) ||
          typeof item.description !== 'string' ||
          !item.description.trim() ||
          Buffer.byteLength(item.description, 'utf8') > 4096 ||
          !routes(item.requiredModuleRoutes) ||
          item.requiredModuleRoutes.some(
            (route) => !family.modules.some((module) => canonicalModuleRoute(module.route) === canonicalModuleRoute(route)),
          ) ||
          !moduleRouteIncluded(item.requiredModuleRoutes, modules.get(item.moduleKey)!.route) ||
          resources
            .get(item.resourceKey)!
            .requiredModuleRoutes.some(
              (route) => !moduleRouteIncluded(item.requiredModuleRoutes, route),
            ) ||
          !Array.isArray(item.actionKeys) ||
          item.actionKeys.length > 64 ||
          new Set(item.actionKeys).size !== item.actionKeys.length ||
          item.actionKeys.some(
            (action) =>
              typeof action !== 'string' ||
              !/^[a-z][a-z0-9_.:-]{0,127}$/.test(action),
          ) ||
          typeof item.handler !== 'function' ||
          typeof item.verifyAuthority !== 'function' ||
          (item.readIsolation !== undefined &&
            item.readIsolation !== 'REPEATABLE READ') ||
          (item.external !== undefined &&
            (!item.external ||
              typeof item.external !== 'object' ||
              typeof item.external.prepare !== 'function' ||
              !['read', 'read_artifact', 'analyze_attachment'].includes(item.kind))) ||
          (item.kind === 'read_artifact' && !item.external) ||
          (item.verifyResultAuthority !== undefined &&
            typeof item.verifyResultAuthority !== 'function') ||
          this.tools.has(item.toolName) ||
          this.byId.has(item.capabilityId)
        )
          invalid();
        const input = compileNodiaAiToolSchema(item.inputSchema),
          output = compileNodiaAiToolSchema(item.outputSchema);
        const requirement: KnowledgeRequirement = {
          capability_id: item.capabilityId,
          revision: item.revision,
          input_schema_sha256: item.inputSchema.sha256,
          output_schema_sha256: item.outputSchema.sha256,
        };
        const requiredFields = Array.isArray(input.schema.required)
          ? (input.schema.required as string[])
          : [];
        const properties = jsonObject(input.schema.properties)
          ? Object.keys(input.schema.properties)
          : [];
        const metadata = {
          capabilityId: item.capabilityId,
          revision: item.revision,
          publication: item.publication,
          toolName: item.toolName,
          kind: item.kind,
          moduleKey: item.moduleKey,
          resourceKey: item.resourceKey,
          operationKey: item.operationKey,
          descriptionKey: item.descriptionKey,
          description: item.description,
          requiredModuleRoutes: [...item.requiredModuleRoutes],
          actionKeys: [...item.actionKeys],
          effectKey: item.effectKey,
          ...(item.readIsolation ? { readIsolation: item.readIsolation } : {}),
          ...(item.external ? { executionBoundary: 'external_v1' } : {}),
          requirement,
          inputSchemaRef: input.ref,
          outputSchemaRef: output.ref,
          inputSchema: input.schema,
          outputSchema: output.schema,
          requiredFields: [...requiredFields],
          optionalFields: properties.filter(
            (field) => !requiredFields.includes(field),
          ),
        };
        const registered = freeze({
          ...metadata,
          contractHash: hash(canonical({ catalogVersion, ...metadata,
            requiredModuleRoutes: metadata.requiredModuleRoutes.map(contractModuleRoute),
          })),
          handler: item.handler,
          verifyAuthority: item.verifyAuthority,
          verifyResultAuthority: item.verifyResultAuthority,
          external: item.external,
        });
        this.tools.set(item.toolName, registered);
        this.byId.set(item.capabilityId, registered);
        this.validators.set(item.toolName, {
          input: input.validate,
          output: output.validate,
        });
      }
    }
    for (const resource of resources.values())
      if (resource.resolveCapabilityId !== undefined) {
        const tool = this.byId.get(resource.resolveCapabilityId);
        if (
          !tool ||
          tool.resourceKey !== resource.key ||
          tool.kind !== 'read' ||
          tool.external !== undefined ||
          !tool.inputSchemaRef.endsWith('#/$defs/EntitySearchInput') ||
          !tool.outputSchemaRef.endsWith('#/$defs/EntityCandidates')
        )
          invalid();
      }
    this.moduleEntries = freeze([...modules.values()]);
    this.resourceEntries = freeze([...resources.values()]);
  }
  get(toolName: string): NodiaAiRegisteredTool | undefined {
    return this.tools.get(toolName);
  }
  findCapability(capabilityId: string): NodiaAiRegisteredTool | undefined {
    return this.byId.get(capabilityId);
  }
  /** Internal metadata lookup only; discovery/execution must still authorize the resource. */
  findEntityResolver(resourceKey: unknown): NodiaAiRegisteredTool | undefined {
    const id = this.resourceEntries.find(
      (resource) => resource.key === resourceKey,
    )?.resolveCapabilityId;
    return id ? this.byId.get(id) : undefined;
  }
  list(moduleRoutes: readonly string[]): readonly NodiaAiRegisteredTool[] {
    const routes = new Set(canonicalModuleRoutes(moduleRoutes));
    return Object.freeze(
      [...this.tools.values()]
        .filter((tool) =>
          tool.requiredModuleRoutes.every((route) => routes.has(canonicalModuleRoute(route))),
        )
        .sort((a, b) =>
          a.toolName < b.toolName ? -1 : a.toolName > b.toolName ? 1 : 0,
        ),
    );
  }
  requirements(): readonly KnowledgeRequirement[] {
    return Object.freeze(
      [...this.byId.values()]
        .map((tool) => tool.requirement)
        .sort((a, b) =>
          a.capability_id < b.capability_id
            ? -1
            : a.capability_id > b.capability_id
              ? 1
              : 0,
        ),
    );
  }
  publishedContracts(): readonly (KnowledgeRequirement & {
    readonly required_module_routes: readonly string[];
    readonly kind: NodiaAiRegisteredTool['kind'];
  })[] {
    return Object.freeze(
      this.requirements().map((requirement) => {
        const tool = this.byId.get(requirement.capability_id)!;
        return freeze({
          ...requirement,
          required_module_routes: tool.requiredModuleRoutes,
          kind: tool.kind,
        });
      }),
    );
  }
  modules(
    moduleRoutes: readonly string[],
  ): readonly NodiaAiToolModuleRegistration[] {
    const keys = new Set(this.list(moduleRoutes).map((tool) => tool.moduleKey));
    return Object.freeze(
      this.moduleEntries.filter((module) => keys.has(module.key)),
    );
  }
  resources(
    moduleRoutes: readonly string[],
  ): readonly NodiaAiToolResourceRegistration[] {
    const keys = new Set(
      this.list(moduleRoutes).map((tool) => tool.resourceKey),
    );
    return Object.freeze(
      this.resourceEntries.filter(
        (resource) =>
          keys.has(resource.key) &&
          resource.requiredModuleRoutes.every((route) =>
            moduleRouteIncluded(moduleRoutes, route),
          ),
      ),
    );
  }
  validateInput(
    tool: NodiaAiRegisteredTool,
    value: unknown,
  ): NodiaAiJsonObject {
    return this.validate(tool, value, 'input');
  }
  validateOutput(
    tool: NodiaAiRegisteredTool,
    value: unknown,
  ): NodiaAiJsonObject {
    return this.validate(tool, value, 'output');
  }
  private validate(
    tool: NodiaAiRegisteredTool,
    value: unknown,
    side: 'input' | 'output',
  ): NodiaAiJsonObject {
    if (this.tools.get(tool.toolName) !== tool) invalid();
    let copied: unknown;
    try {
      const assertJson = (node: unknown, depth: number): void => {
        if (depth > 32) throw new Error('invalid_json');
        if (
          node === null ||
          typeof node === 'string' ||
          typeof node === 'boolean' ||
          (typeof node === 'number' && Number.isFinite(node))
        )
          return;
        if (Array.isArray(node)) {
          for (let index = 0; index < node.length; index++)
            assertJson(node[index], depth + 1);
          return;
        }
        if (!jsonObject(node)) throw new Error('invalid_json');
        for (const property of Object.values(
          Object.getOwnPropertyDescriptors(node),
        )) {
          if (!Object.hasOwn(property, 'value') || !property.enumerable)
            throw new Error('invalid_json');
          assertJson(property.value, depth + 1);
        }
      };
      assertJson(value, 0);
      copied = structuredClone(parseNodiaAiStrictJson(JSON.stringify(value)));
    } catch {
      throw new Error(`nodia_ai:invalid_tool_${side}`);
    }
    if (
      !jsonObject(value) ||
      !jsonObject(copied) ||
      !this.validators.get(tool.toolName)![side](copied)
    )
      throw new Error(`nodia_ai:invalid_tool_${side}`);
    return copied;
  }
}
