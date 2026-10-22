import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../../src/nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { NodiaAiRuntimePolicy } from '../../src/nodia-ai-runtime/config/runtime-policy.js';
import type {
  NodiaAiClaim,
  NodiaAiStageContext,
} from '../../src/nodia-ai-runtime/types/worker.types.js';
import type { NodiaAiAuthorizedActor } from '../../src/nodia-ai/types/nodia-ai-authorization.types.js';
import type { AuthorizeNodiaAiUseCase } from '../../src/nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { LoadNodiaAiKnowledgeUseCase } from '../../src/nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import {
  knowledgeHash,
  canonicalKnowledge,
} from '../../src/nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import type { ExecuteNodiaAiKnowledgeToolUseCase } from '../../src/nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case.js';
import { NODIA_AI_KNOWLEDGE_TOOLS } from '../../src/nodia-ai-context/use-case/execute-nodia-ai-knowledge-tool.use-case.js';
import { NodiaAiRun } from '../../src/nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiToolCall } from '../../src/nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NodiaAiExecutionGrant } from '../../src/nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.js';
import { NodiaAiToolRegistryUseCase } from '../../src/nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import { DiscoverNodiaAiToolsUseCase } from '../../src/nodia-ai-tools/use-case/discover-nodia-ai-tools.use-case.js';
import { ExecuteNodiaAiToolUseCase } from '../../src/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.js';
import { NodiaAiToolSelectionFlowUseCase } from '../../src/nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js';
import { SelectNodiaAiTurnToolsUseCase } from '../../src/nodia-ai-tools/use-case/select-nodia-ai-turn-tools.use-case.js';
import type { NodiaAiReportToolsUseCase } from '../../src/nodia-ai-tools/use-case/nodia-ai-report-tools.use-case.js';
import type { NodiaAiToolRegistration } from '../../src/nodia-ai-tools/types/tool-registry.types.js';
import { eventJournalFixture } from '../../src/nodia-ai-run/event-journal.fixture.js';

/** Only synthetic domain ports; no business registration is imported by production. */
export function toolFixture(
  options: {
    listDefaultRows?: number;
    resultAuthority?: NodiaAiToolRegistration['verifyResultAuthority'];
    readIsolation?: NodiaAiToolRegistration['readIsolation'];
    external?: NodiaAiToolRegistration['external'];
    kind?: NodiaAiToolRegistration['kind'];
    reportTools?: NodiaAiReportToolsUseCase;
  } = {},
) {
  const commonSource = readFileSync(
    new URL(
      '../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
      import.meta.url,
    ),
    'utf8',
  );
  const parsedPolicy = JSON.parse(
    readFileSync(
      new URL(
        '../../../docs/mvp/nodia-ai-v1-runtime-policy.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as NodiaAiRuntimePolicy;
  const policy: NodiaAiRuntimePolicy = {
    ...parsedPolicy,
    results: {
      ...parsedPolicy.results,
      list_default_rows:
        options.listDefaultRows ?? parsedPolicy.results.list_default_rows,
    },
  };
  const schemaSource = JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://fixture.local/domain',
    $defs: {
      Input: {
        type: 'object',
        additionalProperties: false,
        properties: { id: { type: 'string', pattern: '^[1-9][0-9]*$' } },
        required: ['id'],
      },
      Output: {
        type: 'object',
        additionalProperties: false,
        properties: { total: { type: 'string' } },
        required: ['total'],
      },
    },
  });
  const verifyAuthority = vi.fn(async () => {});
  const handler = vi.fn(async (): Promise<NodiaAiJsonObject> => ({
    total: '12.50',
  }));
  const resolverAuthority = vi.fn(async () => {});
  const resolver = vi.fn(async (): Promise<NodiaAiJsonObject> => ({
    status: 'unique',
    candidates: [
      { resource_key: 'fixture.records', id: '1', label: 'Synthetic record' },
    ],
    next_cursor: null,
  }));
  const registration: NodiaAiToolRegistration = {
    capabilityId: 'fixture_read',
    revision: 1,
    publication: 'published',
    toolName: 'nodia_fixture_get',
    kind: options.kind ?? 'read',
    moduleKey: 'fixture',
    resourceKey: 'fixture.records',
    operationKey: 'read',
    descriptionKey: 'fixture_read',
    description: 'Read a synthetic total',
    requiredModuleRoutes: ['/tools/fixture'],
    actionKeys: ['fixture_read'],
    inputSchema: {
      sourceJson: schemaSource,
      definition: 'Input',
      sha256: knowledgeHash(schemaSource),
    },
    outputSchema: {
      sourceJson: schemaSource,
      definition: 'Output',
      sha256: knowledgeHash(schemaSource),
    },
    effectKey: 'none',
    verifyAuthority,
    verifyResultAuthority: options.resultAuthority,
    readIsolation: options.readIsolation,
    external: options.external,
    handler,
  };
  const resolverRegistration: NodiaAiToolRegistration = {
    ...registration,
    capabilityId: 'fixture_resolve',
    toolName: 'nodia_fixture_resolve',
    inputSchema: {
      sourceJson: commonSource,
      definition: 'EntitySearchInput',
      sha256: knowledgeHash(commonSource),
    },
    outputSchema: {
      sourceJson: commonSource,
      definition: 'EntityCandidates',
      sha256: knowledgeHash(commonSource),
    },
    verifyAuthority: resolverAuthority,
    kind: 'read',
    external: undefined,
    handler: resolver,
  };
  const registry = new NodiaAiToolRegistryUseCase(
    [
      {
        familyKey: 'fixture',
        modules: [
          {
            key: 'fixture',
            route: '/tools/fixture',
            label: 'Synthetic fixture',
          },
        ],
        resources: [
          {
            key: 'fixture.records',
            label: 'Synthetic records',
            requiredModuleRoutes: ['/tools/fixture'],
            resolveCapabilityId: 'fixture_resolve',
          },
        ],
        capabilities: [registration, resolverRegistration],
      },
    ],
    'fixture-catalog',
  );
  const manifest = {
    catalog_release: 'fixture-catalog',
    release_id: 'fixture-release',
    capability_contracts: registry.requirements().map((item) => ({
      capability_id: item.capability_id,
      revision: item.revision,
      publication: 'published',
      input_schema: { sha256: item.input_schema_sha256 },
      output_schema: { sha256: item.output_schema_sha256 },
      required_module_routes: ['/tools/fixture'],
    })),
  };
  const knowledge = { manifest } as unknown as LoadNodiaAiKnowledgeUseCase;
  const actor: NodiaAiAuthorizedActor = {
    actorId: '1',
    sessionId: 'de59956f-7b71-4555-9fb0-2f99b8cd4774',
    isSuperAdmin: false,
    modules: [
      { id: '1', key: 'nodia_ai', route: '/tools/nodia-ai' },
      { id: '2', key: 'fixture', route: '/tools/fixture' },
    ],
  };
  const actions = new Set(['fixture_read']);
  const authorize = {
    execute: vi.fn(
      async (
        _identity: unknown,
        requirements: {
          moduleRoutes?: readonly string[];
          actionKeys?: readonly string[];
        } = {},
      ) => {
        if (
          requirements.moduleRoutes?.some(
            (route) => !actor.modules.some((item) => item.route === route),
          ) ||
          (!actor.isSuperAdmin &&
            requirements.actionKeys?.some((action) => !actions.has(action)))
        )
          throw new Error('nodia_ai:capability_denied');
        return actor;
      },
    ),
    filterAuthorized: vi.fn(
      async (
        _identity: unknown,
        requirements: {
          moduleRoutes?: readonly string[];
          actionKeys?: readonly string[];
        }[],
      ) => ({
        actor,
        allowed: requirements.map(
          (requirement) =>
            (requirement.moduleRoutes ?? []).every((route) =>
              actor.modules.some((item) => item.route === route),
            ) &&
            (actor.isSuperAdmin ||
              (requirement.actionKeys ?? []).every((action) =>
                actions.has(action),
              )),
        ),
      }),
    ),
  };
  const receipts = new Map<string, NodiaAiToolCall>();
  const toolRepo = {
    findOneBy: vi.fn(
      async (where: { adapter_call_id: string }) =>
        receipts.get(where.adapter_call_id) ?? null,
    ),
    save: vi.fn(async (entity: NodiaAiToolCall) => {
      receipts.set(entity.adapter_call_id, entity);
      return entity;
    }),
  };
  const run: NodiaAiRun = Object.assign(new NodiaAiRun(), {
    id: 'fixture-run',
    conversation_id: 'fixture-chat',
    actor_id: '1',
    catalog_version: registry.catalogVersion,
    selection_snapshot: {
      connection_id: '2',
      mode: 'token_plan_agentic',
      model_id: 'synthetic-configured-model',
      effort_id: null,
    },
    routing_snapshot: {
      schema_version: 1,
      enabled: false,
      revision: 0,
      target: null,
    },
    context_manifest: {
      knowledge_release: manifest.release_id,
      module_routes: ['/tools/fixture', '/tools/nodia-ai'],
      tool_catalog_version: registry.catalogVersion,
      tool_contracts: {},
    },
  });
  const grant = Object.assign(new NodiaAiExecutionGrant(), {
    run_id: run.id,
    actor_id: actor.actorId,
    session_public_id: actor.sessionId,
    allowed_modules: ['/tools/fixture', '/tools/nodia-ai'],
    allowed_operations: ['chat:respond'],
    revoked_at: null,
    expires_at: new Date(Date.now() + 60000),
  });
  let spent = 0;
  const journal = eventJournalFixture();
  const query = vi.fn(async (sql: string, parameters?: unknown[]) => {
    const eventResult = journal.query(sql, parameters);
    if (eventResult !== undefined) return eventResult;
    if (sql.includes('tool_calls_used=tool_calls_used+1')) {
      if (spent >= policy.budget.tool_calls_per_run) return [];
      spent++;
      return [{ id: run.id }];
    }
    return [];
  });
  const manager = {
    query,
    getRepository: vi.fn((entity: unknown) =>
      entity === NodiaAiToolCall
        ? toolRepo
        : entity === NodiaAiExecutionGrant
          ? { findOneBy: vi.fn(async () => grant) }
          : { findOneByOrFail: vi.fn(async () => run) },
    ),
  } as unknown as EntityManager;
  const claim = {
    run,
    identity: { userId: actor.actorId, sessionId: actor.sessionId },
    job: { stage_key: 'inference' },
    attempt: { id: 'fixture-attempt' },
  } as unknown as NodiaAiClaim;
  const context = {
    checkpoint: vi.fn(
      async (work: (manager: EntityManager) => Promise<unknown>) =>
        work(manager),
    ),
    armDispatch: vi.fn(),
    signal: new AbortController().signal,
  } as unknown as NodiaAiStageContext;
  const discovery = new DiscoverNodiaAiToolsUseCase(
    registry,
    knowledge,
    authorize as unknown as AuthorizeNodiaAiUseCase,
    commonSource,
    policy,
    options.reportTools,
  );
  const knowledgeTools = {
    execute: vi.fn(
      async (_claim: NodiaAiClaim, guardedContext: NodiaAiStageContext) => {
        await guardedContext.checkpoint(async () => {});
        return { items: [] };
      },
    ),
    progress: vi.fn(async () => {}),
  };
  const selectionFlow = new NodiaAiToolSelectionFlowUseCase(
    registry,
    knowledge,
    discovery,
    new SelectNodiaAiTurnToolsUseCase(),
    authorize as unknown as AuthorizeNodiaAiUseCase,
  );
  const subject = new ExecuteNodiaAiToolUseCase(
    registry,
    knowledge,
    knowledgeTools as unknown as ExecuteNodiaAiKnowledgeToolUseCase,
    discovery,
    authorize as unknown as AuthorizeNodiaAiUseCase,
    policy,
    selectionFlow,
    options.reportTools,
  );
  const hashes = Object.fromEntries([
    ...registry
      .list(['/tools/fixture'])
      .map((tool) => [tool.toolName, tool.contractHash]),
    ...discovery
      .descriptors()
      .map((tool) => [tool.name, discovery.contractHash(tool.name)]),
    ...NODIA_AI_KNOWLEDGE_TOOLS.map((tool) => [
      tool.name,
      knowledgeHash(canonicalKnowledge(tool)),
    ]),
  ]);
  run.context_manifest.tool_contracts = hashes;
  grant.allowed_operations.push(...Object.keys(hashes));
  const call = {
    callId: 'fixture-call',
    name: registration.toolName,
    arguments: { id: '1' },
  };
  return {
    selectionFlow,
    subject,
    discovery,
    registry,
    knowledge,
    manifest,
    policy,
    actor,
    actions,
    authorize,
    claim,
    run,
    grant,
    context,
    manager,
    query,
    toolRepo,
    receipts,
    journal,
    handler,
    resolver,
    verifyAuthority,
    resolverAuthority,
    knowledgeTools,
    call,
    spent: () => spent,
  };
}
