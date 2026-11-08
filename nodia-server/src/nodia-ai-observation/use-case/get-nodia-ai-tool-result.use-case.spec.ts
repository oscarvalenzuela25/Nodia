import {
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { DataSource, EntityManager } from 'typeorm';
import { toolFixture } from '../../../test/fixtures/nodia-ai-tools.fixture.js';
import { NodiaAiToolCall } from '../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NodiaAiConversation } from '../../nodia-ai-conversation/entities/nodia-ai-conversation.entity.js';
import { NodiaAiConversationService } from '../../nodia-ai-conversation/nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { NodiaAiAuthorizationService } from '../../nodia-ai/nodia-ai-authorization.service.js';
import type { NodiaAiAuthorizationSnapshot } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import {
  canonicalKnowledge,
  knowledgeHash,
} from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import { GetNodiaAiToolResultUseCase } from './get-nodia-ai-tool-result.use-case.js';
import { projectNodiaAiToolObservation } from './project-nodia-ai-tool-observation.js';
import * as observationProjection from './project-nodia-ai-tool-observation.js';
import type { NodiaAiReportToolsUseCase } from '../../nodia-ai-tools/use-case/nodia-ai-report-tools.use-case.js';

const callId = '203bbdca-e3a4-4a8f-b569-921717eb9501';
const chatId = '5f3ccf10-eeb4-45bb-82ce-97c65324d779';
const completedAt = new Date('2026-10-16T12:00:00Z');
const commonSource = readFileSync(
  new URL(
    '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
    import.meta.url,
  ),
  'utf8',
);
function fixture(options: Parameters<typeof toolFixture>[0] = {}) {
  const tools = toolFixture(options);
  const identity = {
    userId: tools.actor.actorId,
    sessionId: tools.actor.sessionId,
  };
  const current: NodiaAiAuthorizationSnapshot = {
    actorId: identity.userId,
    sessionId: identity.sessionId,
    isSuperAdmin: false,
    modules: tools.actor.modules.map((item) => ({ ...item, assigned: true })),
    actionKeys: ['fixture_read'],
  };
  const authority = {
    loadCurrentActor: vi.fn(
      async () => current as NodiaAiAuthorizationSnapshot | null,
    ),
  };
  const authorize = new AuthorizeNodiaAiUseCase(
    authority as unknown as NodiaAiAuthorizationService,
  );
  const chat = Object.assign(new NodiaAiConversation(), {
    id: chatId,
    owner_id: identity.userId,
    lifecycle: 'active',
    expires_at: new Date('2026-12-01T00:00:00Z'),
  });
  const conversations = {
    find: vi.fn(async () => chat as NodiaAiConversation | null),
    now: vi.fn(async () => completedAt),
    auditInspection: vi.fn(async () => undefined),
  };
  const chatAccess = new AuthorizeNodiaAiConversationUseCase(
    conversations as unknown as NodiaAiConversationService,
    authorize,
  );
  const tool = tools.registry.get('nodia_fixture_get')!;
  const call = Object.assign(new NodiaAiToolCall(), {
    id: callId,
    conversation_id: chatId,
    run_id: 'c83f4426-a039-49b4-bca9-fac28825e49c',
    adapter_call_id: 'synthetic-native-call',
    tool_name: tool.toolName,
    contract_hash: tool.contractHash,
    arguments: { id: '1' },
    arguments_hash: knowledgeHash(canonicalKnowledge({ id: '1' })),
    public_result: { total: '900719925474099312345' },
    state: 'completed',
    scope_manifest: {
      schema_version: 1,
      module_routes: ['/tools/fixture'],
      authority_hash: 'old-frozen-authority',
    },
    created_at: new Date('2026-10-16T11:59:59Z'),
    completed_at: completedAt,
  });
  const repo = {
    findOne: vi.fn(async () => ({
      tool_name: call.tool_name,
      contract_hash: call.contract_hash,
    })),
    findOneBy: vi.fn(async () => call as NodiaAiToolCall | null),
  };
  const manager = {
    getRepository: vi.fn(() => repo),
    query: vi.fn(async () => []),
  } as unknown as EntityManager;
  const isolations: (string | null)[] = [];
  const transaction = vi.fn(
    async (
      first: string | ((value: EntityManager) => Promise<unknown>),
      second?: (value: EntityManager) => Promise<unknown>,
    ) => {
      isolations.push(typeof first === 'string' ? first : null);
      return typeof first === 'string' ? second!(manager) : first(manager);
    },
  );
  const source = { transaction } as unknown as DataSource;
  const subject = new GetNodiaAiToolResultUseCase(
    source,
    authorize,
    chatAccess,
    tools.registry,
    tools.discovery,
    tools.policy,
    commonSource,
    options.reportTools,
  );
  return {
    ...tools,
    identity,
    current,
    authority,
    conversations,
    call,
    repo,
    manager,
    isolations,
    subject,
    tool,
  };
}

describe('NodiaAI persisted report observation', () => {
  function reportFixture() {
    const reports = {
      handles: (name: string) => name === 'nodia_reports_run',
      descriptors: () => [],
      contractHash: vi.fn(() => 'a'.repeat(64)),
      validateInput: vi.fn((_name, value) => value),
      verifyResult: vi.fn(async () => {}),
      execute: vi.fn(),
    };
    const f = fixture({
      reportTools: reports as unknown as NodiaAiReportToolsUseCase,
    });
    f.call.tool_name = 'nodia_reports_run';
    f.call.contract_hash = 'a'.repeat(64);
    return { ...f, reports };
  }
  it('reads a receipt with current authority and original chat owner, without aggregates', async () => {
    const f = reportFixture();
    expect(await f.subject.execute(f.identity, callId)).toEqual(
      f.call.public_result,
    );
    expect(f.reports.verifyResult).toHaveBeenCalledWith(
      f.identity,
      f.call.tool_name,
      f.call.arguments,
      f.call.public_result,
      f.manager,
      f.call.scope_manifest.module_routes,
      f.identity.userId,
    );
    expect(f.reports.execute).not.toHaveBeenCalled();
  });
  it('rejects a changed report contract before reading its stored payload', async () => {
    const f = reportFixture();
    f.call.contract_hash = 'b'.repeat(64);
    await expect(f.subject.execute(f.identity, callId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(f.reports.verifyResult).not.toHaveBeenCalled();
  });
  it('never delivers a stored report after a source authority revocation', async () => {
    const f = reportFixture();
    f.reports.verifyResult.mockRejectedValueOnce(
      new ForbiddenException('synthetic:revoked'),
    );
    await expect(f.subject.execute(f.identity, callId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(f.reports.execute).not.toHaveBeenCalled();
  });
  it('retains the original scope when a super_admin inspects another owner chat', async () => {
    const f = reportFixture();
    f.current.actorId = '3';
    f.current.isSuperAdmin = true;
    const viewer = { ...f.identity, userId: '3' };
    await f.subject.execute(viewer, callId);
    expect(f.reports.verifyResult).toHaveBeenCalledWith(
      viewer,
      f.call.tool_name,
      f.call.arguments,
      f.call.public_result,
      f.manager,
      f.call.scope_manifest.module_routes,
      f.identity.userId,
    );
    expect(f.conversations.auditInspection).toHaveBeenCalledOnce();
  });
});

describe('GetNodiaAiToolResultUseCase', () => {
  afterEach(() => vi.restoreAllMocks());
  it('returns exact registered output from a completed receipt without a runtime grant or provider call', async () => {
    const f = fixture();
    expect(await f.subject.execute(f.identity, callId)).toEqual({
      total: '900719925474099312345',
    });
    await f.subject.execute(f.identity, callId);
    expect(f.handler).not.toHaveBeenCalled();
    expect(f.resolver).not.toHaveBeenCalled();
    expect(f.verifyAuthority).toHaveBeenCalledTimes(2);
    expect(f.isolations).toEqual([
      null,
      'READ COMMITTED',
      null,
      'READ COMMITTED',
    ]);
  });
  it('observes source and original completion date without copying arguments or raw output into metadata', async () => {
    const f = fixture();
    const result = await f.subject.observe(f.identity, callId);
    expect(result).toEqual({
      result_ref: {
        tool_call_id: callId,
        tool_name: f.tool.toolName,
        contract_hash: f.tool.contractHash,
      },
      observed_at: completedAt.toISOString(),
      source: {
        module_key: 'fixture',
        resource_key: 'fixture.records',
        operation_key: 'read',
        description_key: 'fixture_read',
      },
      summary: { total: null, returned: null },
      navigation: [
        {
          kind: 'module',
          id: null,
          module_route: '/tools/fixture',
          label: null,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('900719925474099312345');
    expect(JSON.stringify(result)).not.toContain('arguments');
  });
  it('applies native REPEATABLE READ before the authority verifier', async () => {
    const f = fixture({ readIsolation: 'REPEATABLE READ' });
    f.verifyAuthority.mockImplementation(async () => {
      expect(f.isolations.at(-1)).toBe('REPEATABLE READ');
    });
    await f.subject.observe(f.identity, callId);
    expect(f.isolations).toEqual([null, 'REPEATABLE READ']);
  });
  it('does not call external prepare when observing a stored external result', async () => {
    const prepare = vi.fn(async () => {
      throw Error('must never dispatch');
    });
    const f = fixture({ external: { prepare } });
    await f.subject.execute(f.identity, callId);
    expect(prepare).not.toHaveBeenCalled();
    expect(f.handler).not.toHaveBeenCalled();
  });
  it('authorizes the current session independently of the old completed run', async () => {
    const f = fixture();
    const newer = {
      ...f.identity,
      sessionId: 'd2140855-f69e-4305-8a10-ddf4fd8a1208',
    };
    f.current.sessionId = newer.sessionId;
    expect(await f.subject.execute(newer, callId)).toEqual(
      f.call.public_result,
    );
    f.authority.loadCurrentActor.mockResolvedValue(null);
    await expect(f.subject.execute(newer, callId)).rejects.toMatchObject({
      status: 401,
    });
  });
  it('denies a revoked destination assignment while allowing access without role actions', async () => {
    const f = fixture();
    f.current.modules.find(
      (item) => item.route === '/tools/fixture',
    )!.assigned = false;
    await expect(f.subject.execute(f.identity, callId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(f.verifyAuthority).not.toHaveBeenCalled();
    f.current.modules.find(
      (item) => item.route === '/tools/fixture',
    )!.assigned = true;
    f.current.actionKeys = [];
    await expect(f.subject.observe(f.identity, callId)).resolves.toMatchObject({
      result_ref: { tool_call_id: callId },
    });
    await expect(f.subject.execute(f.identity, callId)).resolves.toEqual(f.call.public_result);
    expect(f.verifyAuthority).toHaveBeenCalledTimes(2);
    expect(f.handler).not.toHaveBeenCalled();
  });
  it('revalidates module revocation between contract lookup and final projection', async () => {
    const f = fixture();
    f.repo.findOne.mockImplementation(async () => {
      f.current.modules[1].assigned = false;
      return {
        tool_name: f.call.tool_name,
        contract_hash: f.call.contract_hash,
      };
    });
    await expect(f.subject.execute(f.identity, callId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(f.handler).not.toHaveBeenCalled();
  });
  it('hides a foreign chat from ordinary users and audits a super_admin inspection', async () => {
    const f = fixture();
    const foreign = Object.assign(new NodiaAiConversation(), {
      id: chatId,
      owner_id: '2',
      lifecycle: 'active',
      expires_at: new Date('2026-12-01T00:00:00Z'),
    });
    f.conversations.find.mockResolvedValue(foreign);
    await expect(f.subject.observe(f.identity, callId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    f.current.isSuperAdmin = true;
    f.current.actionKeys = [];
    await f.subject.observe(f.identity, callId);
    expect(f.conversations.auditInspection).toHaveBeenCalledWith(
      f.manager,
      '1',
      f.identity.sessionId,
      chatId,
      'tool_observation',
    );
    expect(f.handler).not.toHaveBeenCalled();
  });
  it('denies expired own chats even before the retention sweep and hides a purged result', async () => {
    const f = fixture();
    f.conversations.find.mockResolvedValue(
      Object.assign(new NodiaAiConversation(), {
        id: chatId,
        owner_id: '1',
        lifecycle: 'active',
        expires_at: completedAt,
      }),
    );
    await expect(f.subject.execute(f.identity, callId)).rejects.toBeInstanceOf(
      GoneException,
    );
    f.repo.findOneBy.mockResolvedValue(null);
    await expect(f.subject.observe(f.identity, callId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it('rechecks native result authority and rejects cached data after collaborator revocation', async () => {
    const resultAuthority = vi.fn(async () => {
      throw new ForbiddenException('rental:access_denied');
    });
    const f = fixture({ resultAuthority });
    await expect(f.subject.execute(f.identity, callId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(resultAuthority).toHaveBeenCalledOnce();
    expect(f.handler).not.toHaveBeenCalled();
  });
  it.each(['validated', 'received', 'rejected', 'unknown'])(
    'does not expose %s receipts as successful empty data',
    async (state) => {
      const f = fixture();
      f.call.state = state;
      await expect(
        f.subject.observe(f.identity, callId),
      ).rejects.toBeInstanceOf(NotFoundException);
    },
  );
  it('requires a known exact published domain contract and hides technical tool receipts', async () => {
    const f = fixture();
    f.call.contract_hash = '0'.repeat(64);
    await expect(f.subject.execute(f.identity, callId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    f.call.contract_hash = f.tool.contractHash;
    f.manifest.capability_contracts.length = 0;
    await expect(f.subject.execute(f.identity, callId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    f.call.tool_name = 'nodia_knowledge_index';
    await expect(f.subject.execute(f.identity, callId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
  it.each([
    'extra_output',
    'wrong_output',
    'argument_hash',
    'scope',
    'oversize',
    'depth',
  ])(
    'rejects corrupted persisted %s instead of returning generic JSON',
    async (condition) => {
      const f = fixture();
      if (condition === 'extra_output')
        f.call.public_result!.secret = 'must not escape';
      if (condition === 'wrong_output') f.call.public_result = { total: 0 };
      if (condition === 'argument_hash') f.call.arguments_hash = '0'.repeat(64);
      if (condition === 'scope') f.call.scope_manifest.module_routes = [];
      if (condition === 'oversize')
        f.call.public_result = { total: 'x'.repeat(65537) };
      if (condition === 'depth')
        f.call.public_result = {
          total: '0',
          nested: Array.from({ length: 129 }, () => null),
        };
      await expect(f.subject.execute(f.identity, callId)).rejects.toMatchObject(
        { status: 500, message: 'nodia_ai:invalid_persisted_state' },
      );
      expect(f.handler).not.toHaveBeenCalled();
    },
  );
  it('validates registered resolver semantics without executing the resolver', async () => {
    const f = fixture();
    const resolver = f.registry.get('nodia_fixture_resolve')!;
    Object.assign(f.call, {
      tool_name: resolver.toolName,
      contract_hash: resolver.contractHash,
      arguments: {
        resource_key: 'fixture.records',
        term: 'Synthetic',
        catalog_version: 'fixture-catalog',
        scope: {},
      },
      public_result: {
        status: 'unique',
        candidates: [
          {
            resource_key: 'fixture.records',
            id: '1',
            label: 'Synthetic record',
          },
        ],
        next_cursor: null,
      },
    });
    f.call.arguments_hash = knowledgeHash(canonicalKnowledge(f.call.arguments));
    expect((await f.subject.observe(f.identity, callId)).summary.returned).toBe(
      1,
    );
    f.call.public_result!.status = 'ambiguous';
    await expect(f.subject.execute(f.identity, callId)).rejects.toMatchObject({
      status: 500,
    });
    expect(f.resolver).not.toHaveBeenCalled();
  });
  it('projects only known record IDs and genuine counts, capping navigation without truncating the result', () => {
    const f = fixture();
    const data = Array.from({ length: 30 }, (_item, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `Synthetic ${index}`,
    }));
    const tool = { ...f.tool, toolName: 'nodia_businesses_list' };
    const projected = projectNodiaAiToolObservation(
      f.call,
      tool,
      {},
      { data, meta: { total_items: 0 } },
      '/business',
    );
    expect(projected.summary).toEqual({ total: 0, returned: 30 });
    expect(projected.navigation).toHaveLength(25);
    expect(projected.navigation[0]).toEqual({
      kind: 'business_detail',
      id: data[0].id,
      module_route: '/tools/business',
      label: 'Synthetic 0',
    });
    expect(data).toHaveLength(30);
  });
  it('uses only a reauthorized property context or a module route, never provider URLs or fake detail paths', () => {
    const f = fixture();
    const result = {
      data: [],
      url: 'https://untrusted.invalid',
      meta: { total_items: '900719925474099312345' },
    };
    const rental = projectNodiaAiToolObservation(
      f.call,
      f.tool,
      { property_id: '9007199254740993' },
      result,
      '/reservations',
    );
    expect(rental.navigation).toEqual([
      {
        kind: 'rental_property',
        id: '9007199254740993',
        module_route: '/tools/reservations',
        label: null,
      },
    ]);
    expect(rental.summary).toEqual({
      total: '900719925474099312345',
      returned: 0,
    });
    const invalid = projectNodiaAiToolObservation(
      f.call,
      f.tool,
      { property_id: '../../elsewhere' },
      {},
      '/reservations',
    );
    expect(invalid.navigation).toEqual([
      {
        kind: 'module',
        id: null,
        module_route: '/tools/reservations',
        label: null,
      },
    ]);
    expect(JSON.stringify(rental)).not.toContain('https:');
  });
  it.each([
    'unknown_field',
    'unknown_source',
    'untrusted_navigation',
    'invalid_id',
    'invalid_label',
    'invalid_date',
  ])(
    'rejects invalid %s metadata at the public runtime boundary',
    async (condition) => {
      const f = fixture();
      const valid = await f.subject.observe(f.identity, callId);
      const corrupted = {
        ...valid,
        ...(condition === 'unknown_field'
          ? { internal_token: 'synthetic-must-not-escape' }
          : {}),
      };
      if (condition === 'unknown_source')
        Object.assign(corrupted.source, { unregistered_field: true });
      if (condition === 'untrusted_navigation')
        corrupted.navigation = [
          {
            kind: 'module',
            id: null,
            module_route: 'https://untrusted.invalid',
            label: null,
          },
        ];
      if (condition === 'invalid_id')
        corrupted.navigation = [
          {
            kind: 'business_detail',
            id: '../../private',
            module_route: '/tools/business',
            label: null,
          },
        ];
      if (condition === 'invalid_label')
        corrupted.navigation = [
          {
            kind: 'module',
            id: null,
            module_route: '/tools/fixture',
            label: 'x'.repeat(257),
          },
        ];
      if (condition === 'invalid_date') corrupted.observed_at = 'yesterday';
      vi.spyOn(
        observationProjection,
        'projectNodiaAiToolObservation',
      ).mockReturnValueOnce(corrupted);
      await expect(f.subject.observe(f.identity, callId)).rejects.toMatchObject(
        { status: 500, message: 'nodia_ai:invalid_persisted_state' },
      );
      expect(f.handler).not.toHaveBeenCalled();
    },
  );
  it.each(['', 'x'.repeat(257), 'x'.repeat(400)])(
    'drops a label outside the public character bounds without inventing a replacement',
    (label) => {
      const f = fixture();
      const result = projectNodiaAiToolObservation(
        f.call,
        { ...f.tool, toolName: 'nodia_businesses_get' },
        {},
        { data: { id: chatId, name: label } },
        '/business',
      );
      expect(result.navigation).toEqual([
        {
          kind: 'business_detail',
          id: chatId,
          module_route: '/tools/business',
          label: null,
        },
      ]);
    },
  );
  it('keeps a valid Unicode label within 256 characters rather than treating character limits as byte limits', () => {
    const f = fixture();
    const label = 'ñ'.repeat(256);
    const result = projectNodiaAiToolObservation(
      f.call,
      { ...f.tool, toolName: 'nodia_businesses_get' },
      {},
      { data: { id: chatId, name: label } },
      '/business',
    );
    expect(result.navigation[0].label).toBe(label);
  });
  it('accepts a valid historical domain UUID without applying the new-protocol UUIDv4 constraint', async () => {
    const f = fixture();
    const valid = await f.subject.observe(f.identity, callId);
    const historicalId = 'f47ac10b-58cc-11cf-a447-001122334455';
    const projection = projectNodiaAiToolObservation(
      f.call,
      { ...f.tool, toolName: 'nodia_businesses_get' },
      {},
      { data: { id: historicalId, name: 'Synthetic historical business' } },
      '/business',
    );
    vi.spyOn(
      observationProjection,
      'projectNodiaAiToolObservation',
    ).mockReturnValueOnce({ ...valid, navigation: projection.navigation });
    expect(
      (await f.subject.observe(f.identity, callId)).navigation[0],
    ).toMatchObject({ kind: 'business_detail', id: historicalId });
  });
  it('matches the actual business-detail data envelope and never invents support for a direct result', async () => {
    const f = fixture();
    const { compileNodiaAiToolSchema } =
      await import('../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js');
    const sourceJson = readFileSync(
      new URL(
        '../../nodia-ai-products/contracts/business.schema.json',
        import.meta.url,
      ),
      'utf8',
    );
    const schema = compileNodiaAiToolSchema({
      sourceJson,
      definition: 'BusinessesGetResult',
      sha256: knowledgeHash(sourceJson),
    });
    const business = {
      id: chatId,
      owner_id: '1',
      is_active: true,
      name: 'Synthetic business',
      has_description: false,
      translates: [],
      created_at: completedAt.toISOString(),
      updated_at: completedAt.toISOString(),
    };
    expect(schema.validate({ data: business })).toBe(true);
    expect(schema.validate(business)).toBe(false);
    const tool = { ...f.tool, toolName: 'nodia_businesses_get' };
    expect(
      projectNodiaAiToolObservation(
        f.call,
        tool,
        {},
        { data: business },
        '/business',
      ).navigation[0],
    ).toMatchObject({ kind: 'business_detail', id: chatId });
    expect(
      projectNodiaAiToolObservation(
        f.call,
        tool,
        {},
        business,
        '/business',
      ).navigation,
    ).toEqual([
      {
        kind: 'module',
        id: null,
        module_route: '/tools/business',
        label: null,
      },
    ]);
  });
  it('matches the direct rental-property result and keeps an unsupported business-style envelope at module scope', () => {
    const f = fixture();
    const tool = { ...f.tool, toolName: 'nodia_rental_properties_get' };
    expect(
      projectNodiaAiToolObservation(
        f.call,
        tool,
        {},
        { id: '123', name: 'Synthetic property' },
        '/reservations',
      ).navigation,
    ).toEqual([
      {
        kind: 'rental_property',
        id: '123',
        module_route: '/tools/reservations',
        label: 'Synthetic property',
      },
    ]);
    expect(
      projectNodiaAiToolObservation(
        f.call,
        tool,
        {},
        { data: { id: '123', name: 'Synthetic property' } },
        '/reservations',
      ).navigation,
    ).toEqual([
      {
        kind: 'module',
        id: null,
        module_route: '/tools/reservations',
        label: null,
      },
    ]);
  });
});
