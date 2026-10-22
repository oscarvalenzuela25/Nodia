import { Inject, Injectable } from '@nestjs/common';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { createRequire } from 'node:module';
import type { ValidateFunction } from 'ajv';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiAuthorizedActor } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import {
  LoadNodiaAiKnowledgeUseCase,
  canonicalKnowledge,
  knowledgeHash,
} from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  NodiaAiToolRegistryUseCase,
  compileNodiaAiToolSchema,
} from './nodia-ai-tool-registry.use-case.js';
import type { NodiaAiRegisteredTool } from '../types/tool-registry.types.js';
import { isNodiaAiMcpExecutableRegistration } from '../types/tool-registry.types.js';
import { parseNodiaAiStrictJson } from '../../nodia-ai-context/strict-json.js';
import type { NodiaAiAdapterTool } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import { NodiaAiReportToolsUseCase } from './nodia-ai-report-tools.use-case.js';

export const NODIA_AI_TOOL_COMMON_SCHEMA = Symbol(
  'NODIA_AI_TOOL_COMMON_SCHEMA',
);
export const NODIA_AI_COMMON_TOOL_NAMES = Object.freeze([
  'nodia_capabilities_search',
  'nodia_capabilities_describe',
  'nodia_entities_search',
]);
type DiscoveryKind = 'search' | 'describe' | 'schema' | 'entities';
const contracts = {
  search: ['CatalogSearchInput', 'CatalogSearchResult'],
  describe: ['CatalogDescribeInput', 'CapabilityDescriptor'],
  schema: ['CatalogDescribeInput', 'CapabilitySchemas'],
  entities: ['EntitySearchInput', 'EntityCandidates'],
} as const;
function fail(code = 'invalid_tool_input'): never {
  throw new Error(`nodia_ai:${code}`);
}

/** Shared HTTP/MCP catalog projections. No controller lookup, repository traversal or SQL supplied by the model. */
@Injectable()
export class DiscoverNodiaAiToolsUseCase {
  private readonly validators = new Map<string, ValidateFunction>();
  private readonly document: NodiaAiJsonObject;
  private readonly source: string;
  private readonly commonDescriptors: readonly NodiaAiAdapterTool[];
  private readonly hashes = new Map<string, string>();
  constructor(
    private readonly registry: NodiaAiToolRegistryUseCase,
    private readonly knowledge: LoadNodiaAiKnowledgeUseCase,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    @Inject(NODIA_AI_TOOL_COMMON_SCHEMA) source: string,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly reports?: NodiaAiReportToolsUseCase,
  ) {
    this.source = source;
    this.document = JSON.parse(source) as NodiaAiJsonObject;
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
    ajv.addSchema(this.document);
    for (const definition of new Set(Object.values(contracts).flat())) {
      const validate = ajv.getSchema(
        `${this.document.$id}#/$defs/${definition}`,
      );
      if (!validate) fail('tool_registry_invalid');
      this.validators.set(definition, validate);
    }
    this.commonDescriptors = this.buildDescriptors();
    for (const descriptor of this.commonDescriptors)
      this.hashes.set(
        descriptor.name,
        knowledgeHash(
          canonicalKnowledge({
            descriptor,
            schema: this.document,
            catalog: this.registry.catalogVersion,
          }),
        ),
      );
  }
  descriptors() {
    return [
      ...structuredClone(this.commonDescriptors),
      ...(this.reports?.descriptors() ?? []),
    ];
  }
  /** Complete trusted registration metadata; current authority is applied separately. */
  registeredCatalog(): readonly NodiaAiRegisteredTool[] {
    return this.registry
      .requirements()
      .map((item) => this.registry.findCapability(item.capability_id)!);
  }
  private buildDescriptors() {
    return NODIA_AI_COMMON_TOOL_NAMES.map((name, index) => {
      const kind = (['search', 'describe', 'entities'] as const)[index];
      return {
        name,
        description:
          kind === 'search'
            ? 'Discover verified Nodia capabilities authorized for this conversation; an empty result enables no business operation.'
            : kind === 'describe'
              ? 'Describe one exact authorized capability and its contract. This does not execute a change.'
              : 'Resolve an entity using a registered resource resolver. Ambiguous matches require a human choice.',
        inputSchema: structuredClone(
          compileNodiaAiToolSchema({
            sourceJson: this.source,
            definition: contracts[kind][0],
            sha256: knowledgeHash(this.source),
          }).schema,
        ),
      };
    });
  }
  contractHash(name: string): string {
    if (this.reports?.handles(name)) return this.reports.contractHash(name);
    const hash = this.hashes.get(name);
    if (!hash) fail('capability_denied');
    return hash;
  }
  validateInput(kind: DiscoveryKind, value: unknown): NodiaAiJsonObject {
    const input = this.validate(contracts[kind][0], value, 'input');
    for (const field of ['query', 'term'])
      if (
        typeof input[field] === 'string' &&
        ([...input[field]].length > 256 ||
          Buffer.byteLength(input[field], 'utf8') > 1024)
      )
        fail();
    for (const field of [
      'tool_name',
      'module_key',
      'resource_key',
      'catalog_version',
    ])
      if (typeof input[field] === 'string' && input[field].length > 128) fail();
    if (typeof input.cursor === 'string' && input.cursor.length > 2048) fail();
    return input;
  }
  async visible(
    manager: EntityManager,
    actor: NodiaAiAuthorizedActor,
    moduleRoutes: readonly string[],
  ) {
    const candidates = this.registry
      .list(moduleRoutes)
      .filter((tool) => this.published(tool));
    if (candidates.length === 0) return [];
    const { allowed } = await this.authorize.filterAuthorized(
      { userId: actor.actorId, sessionId: actor.sessionId },
      candidates.map((tool) => ({
        moduleRoutes: tool.requiredModuleRoutes,
        actionKeys: tool.actionKeys,
      })),
      manager,
    );
    return candidates.filter((_tool, index) => allowed[index]);
  }
  published(tool: NodiaAiRegisteredTool): boolean {
    return this.knowledge.manifest.capability_contracts.some(
      (item) =>
        item.capability_id === tool.requirement.capability_id &&
        item.revision === tool.requirement.revision &&
        item.input_schema.sha256 === tool.requirement.input_schema_sha256 &&
        item.output_schema.sha256 === tool.requirement.output_schema_sha256 &&
        canonicalKnowledge([...item.required_module_routes].sort()) ===
          canonicalKnowledge([...tool.requiredModuleRoutes].sort()),
    );
  }
  async execute(
    manager: EntityManager,
    actor: NodiaAiAuthorizedActor,
    moduleRoutes: readonly string[],
    kind: DiscoveryKind,
    value: unknown,
    signal?: AbortSignal,
    permittedToolNames?: readonly string[],
    catalogOnly = false,
  ): Promise<NodiaAiJsonObject> {
    if (signal?.aborted) fail('cancelled');
    const input = this.validateInput(kind, value);
    const visible = (await this.visible(manager, actor, moduleRoutes)).filter(
      (tool) =>
        (catalogOnly && (kind === 'search' || kind === 'describe')) ||
        !permittedToolNames ||
        permittedToolNames.includes(tool.toolName),
    );
    if (
      input.catalog_version !== undefined &&
      input.catalog_version !== this.registry.catalogVersion
    )
      fail('catalog_changed');
    let result: NodiaAiJsonObject;
    if (kind === 'search') {
      const term =
        typeof input.query === 'string' ? input.query.toLowerCase().trim() : '';
      const matching = visible.filter(
        (tool) =>
          (!input.module_key || tool.moduleKey === input.module_key) &&
          (!term ||
            `${tool.toolName} ${tool.description} ${tool.moduleKey} ${tool.resourceKey}`
              .toLowerCase()
              .includes(term)),
      );
      const cursorScope = knowledgeHash(
        canonicalKnowledge({
          catalog: this.registry.catalogVersion,
          actor: actor.actorId,
          session: actor.sessionId,
          routes: [...moduleRoutes].sort(),
          query: term,
          module: input.module_key ?? null,
          visible: visible.map((tool) => tool.contractHash),
        }),
      );
      let after = '';
      if (input.cursor !== undefined) {
        try {
          const cursorBytes = Buffer.from(input.cursor as string, 'base64url');
          if (cursorBytes.toString('base64url') !== input.cursor) return fail();
          const cursor = parseNodiaAiStrictJson(
            cursorBytes.toString('utf8'),
          ) as { after?: unknown; scope?: unknown };
          if (
            Object.keys(cursor).sort().join(',') !== 'after,scope' ||
            cursor.scope !== cursorScope ||
            typeof cursor.after !== 'string' ||
            !matching.some((tool) => tool.toolName === cursor.after)
          )
            return fail();
          after = cursor.after;
        } catch {
          return fail();
        }
      }
      const remaining = matching.filter((tool) => tool.toolName > after);
      const selected = remaining.slice(
        0,
        this.policy.results.list_default_rows,
      );
      result = {
        catalog_version: this.registry.catalogVersion,
        items: selected.map((tool) => this.summary(tool, catalogOnly)),
        next_cursor:
          remaining.length > selected.length
            ? Buffer.from(
                JSON.stringify({
                  after: selected.at(-1)!.toolName,
                  scope: cursorScope,
                }),
              ).toString('base64url')
            : null,
      };
    } else if (kind === 'entities') {
      const resource = this.registry
        .resources(moduleRoutes)
        .find((item) => item.key === input.resource_key);
      const tool = resource?.resolveCapabilityId
        ? visible.find(
            (item) => item.capabilityId === resource.resolveCapabilityId,
          )
        : undefined;
      if (!tool || tool.kind !== 'read') fail('capability_denied');
      const handlerContext = { manager, actor, moduleRoutes, signal };
      const args = this.validateResolverInput(tool, input);
      await tool.verifyAuthority(args, handlerContext);
      result = this.validateResolverOutput(
        tool,
        args,
        await tool.handler(args, handlerContext),
      );
    } else {
      const tool = visible.find((item) => item.toolName === input.tool_name);
      if (!tool) fail('capability_denied');
      result =
        kind === 'schema'
          ? {
              catalog_version: this.registry.catalogVersion,
              tool_name: tool.toolName,
              contract_hash: tool.contractHash,
              input_schema: structuredClone(tool.inputSchema),
              output_schema: structuredClone(tool.outputSchema),
            }
          : {
              catalog_version: this.registry.catalogVersion,
              capability: this.summary(tool, catalogOnly),
              input_schema_ref: tool.inputSchemaRef,
              output_schema_ref: tool.outputSchemaRef,
              required_fields: [...tool.requiredFields],
              optional_fields: [...tool.optionalFields],
              effect_key: tool.effectKey,
              contract_hash: tool.contractHash,
            };
    }
    return this.validate(contracts[kind][1], result, 'output');
  }
  private summary(
    tool: NodiaAiRegisteredTool,
    catalogOnly = false,
  ): NodiaAiJsonObject {
    return {
      tool_name: tool.toolName,
      kind: tool.kind,
      module_key: tool.moduleKey,
      description_key: tool.descriptionKey,
      availability:
        !catalogOnly && isNodiaAiMcpExecutableRegistration(tool)
          ? 'available'
          : 'blocked',
      block_reason: catalogOnly
        ? 'nodia_ai:tool_selection_required'
        : isNodiaAiMcpExecutableRegistration(tool)
          ? null
          : 'nodia_ai:operation_not_implemented',
    };
  }
  async verifyEntityAuthority(
    manager: EntityManager,
    actor: NodiaAiAuthorizedActor,
    moduleRoutes: readonly string[],
    value: unknown,
    signal?: AbortSignal,
    permittedToolNames?: readonly string[],
  ): Promise<void> {
    const input = this.validateInput('entities', value);
    const visible = (await this.visible(manager, actor, moduleRoutes)).filter(
      (tool) =>
        !permittedToolNames || permittedToolNames.includes(tool.toolName),
    );
    const resource = this.registry
      .resources(moduleRoutes)
      .find((item) => item.key === input.resource_key);
    const tool = resource?.resolveCapabilityId
      ? visible.find(
          (item) => item.capabilityId === resource.resolveCapabilityId,
        )
      : undefined;
    if (!tool || tool.kind !== 'read') fail('capability_denied');
    await tool.verifyAuthority(this.validateResolverInput(tool, input), {
      manager,
      actor,
      moduleRoutes,
      signal,
    });
  }
  isEntityResolver(
    tool: NodiaAiRegisteredTool,
    moduleRoutes: readonly string[],
  ): boolean {
    return this.registry
      .resources(moduleRoutes)
      .some((resource) => resource.resolveCapabilityId === tool.capabilityId);
  }
  validateResolverInput(
    tool: NodiaAiRegisteredTool,
    value: unknown,
  ): NodiaAiJsonObject {
    const input = this.validateInput('entities', value);
    if (input.catalog_version !== this.registry.catalogVersion)
      fail('catalog_changed');
    if (input.resource_key !== tool.resourceKey) fail('invalid_tool_input');
    return this.registry.validateInput(tool, input);
  }
  validateResolverOutput(
    tool: NodiaAiRegisteredTool,
    input: NodiaAiJsonObject,
    value: unknown,
  ): NodiaAiJsonObject {
    if (input.resource_key !== tool.resourceKey) fail('invalid_tool_input');
    return this.validateResult(
      'entities',
      this.registry.validateOutput(tool, value),
      tool.resourceKey,
    );
  }
  validateResult(
    kind: DiscoveryKind,
    value: unknown,
    resourceKey?: string,
  ): NodiaAiJsonObject {
    const result = this.validate(contracts[kind][1], value, 'output');
    if (kind !== 'entities') return result;
    if (!resourceKey) fail('invalid_tool_output');
    const candidates = result.candidates as NodiaAiJsonObject[];
    if (
      candidates.length > this.policy.results.list_max_rows ||
      new Set(
        candidates.map(
          (item) => `${item.resource_key}:${String(item.id).toLowerCase()}`,
        ),
      ).size !== candidates.length ||
      candidates.some(
        (item) =>
          item.resource_key !== resourceKey ||
          (typeof item.id === 'string' &&
            /^[0-9]+$/.test(item.id) &&
            BigInt(item.id) > 9223372036854775807n),
      )
    )
      fail('invalid_tool_output');
    const expected =
      candidates.length === 0 && result.next_cursor === null
        ? 'empty'
        : candidates.length === 1 && result.next_cursor === null
          ? 'unique'
          : 'ambiguous';
    if (
      result.status !== expected ||
      (candidates.length === 0 && result.next_cursor !== null)
    )
      fail('invalid_tool_output');
    return result;
  }
  private validate(
    definition: string,
    value: unknown,
    side: 'input' | 'output',
  ): NodiaAiJsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      fail(`invalid_tool_${side}`);
    const walk = (item: unknown, depth: number): void => {
      if (depth > this.policy.results.json_depth) fail(`invalid_tool_${side}`);
      if (typeof item === 'number' && !Number.isFinite(item))
        fail(`invalid_tool_${side}`);
      if (item && typeof item === 'object') {
        if (
          !Array.isArray(item) &&
          Object.getPrototypeOf(item) !== Object.prototype &&
          Object.getPrototypeOf(item) !== null
        )
          fail(`invalid_tool_${side}`);
        const entries = Object.values(item);
        if (entries.length > this.policy.results.json_collection_items)
          fail(`invalid_tool_${side}`);
        for (const child of entries) walk(child, depth + 1);
      } else if (
        item !== null &&
        !['string', 'number', 'boolean'].includes(typeof item)
      )
        fail(`invalid_tool_${side}`);
    };
    walk(value, 0);
    const raw = JSON.stringify(value);
    if (
      Buffer.byteLength(raw, 'utf8') >
        (side === 'input'
          ? this.policy.results.tool_arguments_utf8_bytes
          : this.policy.results.tool_result_utf8_bytes) ||
      !this.validators.get(definition)!(value)
    )
      fail(`invalid_tool_${side}`);
    return JSON.parse(raw) as NodiaAiJsonObject;
  }
}
