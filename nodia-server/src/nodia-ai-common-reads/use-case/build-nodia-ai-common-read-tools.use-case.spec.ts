import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import { ManageNodiaAiAttachmentUseCase } from '../../nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case.js';
import { ListNodiaAiPreferencesUseCase } from '../../nodia-ai-preference/use-case/list-nodia-ai-preferences.use-case.js';
import { NodiaAiPreferenceReaderUseCase } from '../../nodia-ai-preference/use-case/nodia-ai-preference-reader.use-case.js';
import type { NodiaAiProposalService } from '../../nodia-ai-proposal/nodia-ai-proposal.service.js';
import type { NodiaAiPreferenceService } from '../../nodia-ai-preference/nodia-ai-preference.service.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { proposalFixture } from '../../nodia-ai-proposal/use-case/proposal.fixture.js';
import { preferenceFixture } from '../../nodia-ai-preference/use-case/preference.fixture.js';
import { BuildNodiaAiCommonReadToolsUseCase } from './build-nodia-ai-common-read-tools.use-case.js';
import { NodiaAiCommonReadsModule } from '../nodia-ai-common-reads.module.js';
import type { NodiaAiToolHandlerContext } from '../../nodia-ai-tools/types/tool-registry.types.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
function fixture() {
  const f = proposalFixture();
  const proposals = new GetNodiaAiProposalUseCase(
    f.store as unknown as NodiaAiProposalService,
    f.authorize as unknown as AuthorizeNodiaAiUseCase,
    f.authorizeChat as unknown as AuthorizeNodiaAiConversationUseCase,
    f.validate,
    f.policy,
  );
  const operations = {
    load: vi.fn(async () => ({
      execution_id: randomUUID(),
      revision: 1,
      state: 'completed',
      steps: [],
      can_resume: false,
      observed_at: new Date().toISOString(),
    })),
  };
  const attachments = {
    getInTransaction: vi.fn(
      async (_manager: unknown, _identity: unknown, id: string) => ({
        attachment_id: id,
        conversation_id: f.chat.id,
        kind: 'audio',
        state: 'ready',
        media_type: 'audio/webm',
        byte_count: 0,
        page_count: null,
        duration_seconds: 0,
        file_name: 'private.webm',
        interpretation: { text: 'private transcript', reviewed: true },
        storage_key: 'private',
        content_hash: 'private',
      }),
    ),
  };
  const prefs = preferenceFixture();
  const store = prefs.store as unknown as NodiaAiPreferenceService,
    auth = prefs.authorize as unknown as AuthorizeNodiaAiUseCase;
  const preferences = new ListNodiaAiPreferencesUseCase(
    store,
    auth,
    new NodiaAiPreferenceReaderUseCase(store, auth),
  );
  const tools = new BuildNodiaAiCommonReadToolsUseCase(
    proposals,
    operations as unknown as GetNodiaAiExecutionUseCase,
    attachments as unknown as ManageNodiaAiAttachmentUseCase,
    preferences,
  ).execute()[0].capabilities;
  const context: NodiaAiToolHandlerContext = {
    manager: f.manager,
    actor: f.actor,
    moduleRoutes: f.actor.modules.map((m) => m.route),
    conversationId: f.chat.id,
    runId: randomUUID(),
  };
  return {
    ...f,
    proposals,
    operations,
    attachments,
    prefs,
    preferences,
    tools,
    context,
    tool: (name: string) => tools.find((t) => t.toolName === name)!,
  };
}
describe('AI36-C04 native common read adapters', () => {
  it('default publication imports nothing and rejects duplicate/unknown IDs', () => {
    expect(NodiaAiCommonReadsModule.forPublication([]).imports).toBeUndefined();
    expect(NodiaAiCommonReadsModule.forPublication([]).providers).toHaveLength(
      1,
    );
    expect(() =>
      NodiaAiCommonReadsModule.forPublication(['unknown']),
    ).toThrow();
    expect(() =>
      NodiaAiCommonReadsModule.forPublication([
        'nodia_proposals_get',
        'nodia_proposals_get',
      ]),
    ).toThrow();
    expect(
      NodiaAiCommonReadsModule.forPublication(['nodia_proposals_get']).imports,
    ).toHaveLength(4);
  });
  it('offers exactly four bounded native candidate reads', () => {
    const f = fixture();
    expect(f.tools).toHaveLength(4);
    for (const tool of f.tools) {
      expect(tool.kind).toBe('read');
      expect(tool.requiredModuleRoutes).toEqual(['/tools/nodia-ai']);
      compileNodiaAiToolSchema(tool.inputSchema);
      compileNodiaAiToolSchema(tool.outputSchema);
    }
  });
  it.each([
    ['nodia_proposals_get', { proposal_id: randomUUID(), user_id: '2' }],
    ['nodia_operations_get', { operation_id: randomUUID() }],
    [
      'nodia_attachments_describe',
      { attachment_id: randomUUID(), conversation_id: randomUUID() },
    ],
    ['nodia_preferences_list', { owner_id: '2' }],
    ['nodia_preferences_list', { page_limit: 51 }],
    ['nodia_preferences_list', { scope_key: 'system' }],
    ['nodia_preferences_list', { cursor: null }],
  ])(
    'rejects forged scope and incompatible input for %s',
    async (name, input) => {
      const f = fixture();
      await expect(f.tool(name).handler(input, f.context)).rejects.toThrow(
        'nodia_ai:invalid_tool_input',
      );
    },
  );
  it('reads exact public proposal with native authority and no nested transaction or private commands', async () => {
    const f = fixture(),
      tool = f.tool('nodia_proposals_get');
    const transaction = vi.spyOn(f.store, 'transaction');
    const result = await tool.handler(
      { proposal_id: f.proposal.id },
      f.context,
    );
    expect(result.hash).toBe(f.revision.hash);
    expect(result.steps).toEqual([f.step.public_step]);
    expect(result).not.toHaveProperty('actor_id');
    expect(JSON.stringify(result)).not.toContain('command_template');
    expect(transaction).not.toHaveBeenCalled();
    expect(f.preparer.verifyAuthority).toHaveBeenCalledOnce();
    expect(f.preparer.prepare).not.toHaveBeenCalled();
  });
  it('denies another conversation before probing its authorization even for super_admin', async () => {
    const f = fixture();
    f.context.actor.isSuperAdmin = true;
    await expect(
      f
        .tool('nodia_proposals_get')
        .handler(
          { proposal_id: f.proposal.id },
          { ...f.context, conversationId: randomUUID() },
        ),
    ).rejects.toThrow('nodia_ai:proposal_not_found');
    expect(f.authorizeChat.execute).not.toHaveBeenCalled();
  });
  it('revalidates native resource permission on historical exact proposal without changing it', async () => {
    const f = fixture(),
      tool = f.tool('nodia_proposals_get'),
      input = { proposal_id: f.proposal.id };
    const result = await tool.handler(input, f.context),
      frozen = JSON.stringify(result);
    await tool.verifyResultAuthority!(input, result, f.context);
    expect(JSON.stringify(result)).toBe(frozen);
    f.preparer.verifyAuthority = vi.fn(async () => {
      throw new ForbiddenException('nodia_ai:capability_denied');
    });
    await expect(
      tool.verifyResultAuthority!(input, result, f.context),
    ).rejects.toThrow('nodia_ai:capability_denied');
  });
  it('rejects semantically valid tampered public proposal hashes or steps on recovery', async () => {
    const f = fixture(),
      tool = f.tool('nodia_proposals_get'),
      input = { proposal_id: f.proposal.id },
      result = await tool.handler(input, f.context);
    await expect(
      tool.verifyResultAuthority!(
        input,
        { ...result, hash: 'a'.repeat(64) },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_output');
    await expect(
      tool.verifyResultAuthority!(
        input,
        { ...result, execution_id: randomUUID() },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_output');
    const changed = structuredClone(result);
    const steps = changed.steps as Record<string, unknown>[];
    steps[0].effect_key = 'unrelated.effect';
    await expect(
      tool.verifyResultAuthority!(input, changed as never, f.context),
    ).rejects.toThrow('nodia_ai:invalid_tool_output');
  });
  it('binds operation native read to current conversation and exact execution input', async () => {
    const f = fixture(),
      id = randomUUID();
    await f
      .tool('nodia_operations_get')
      .handler({ execution_id: id }, f.context);
    expect(f.operations.load).toHaveBeenCalledWith(
      f.manager,
      { userId: f.actor.actorId, sessionId: f.actor.sessionId },
      id,
      f.chat.id,
    );
  });
  it('replays historical operation states only with references belonging to the same native steps', async () => {
    const f = fixture(),
      id = randomUUID(),
      stepId = randomUUID(),
      tool = f.tool('nodia_operations_get'),
      input = { execution_id: id };
    const current = {
      execution_id: id,
      revision: 2,
      state: 'completed',
      steps: [
        {
          step_id: stepId,
          state: 'completed',
          result_refs: [{ resource_key: 'providers', id: '7' }],
          error: null,
        },
      ],
      can_resume: false,
      observed_at: new Date().toISOString(),
    };
    f.operations.load.mockResolvedValue(current as never);
    const past = {
      ...current,
      revision: 1,
      state: 'running',
      steps: [{ ...current.steps[0], state: 'running', result_refs: [] }],
    };
    await expect(
      tool.verifyResultAuthority!(input, past, f.context),
    ).resolves.toBeUndefined();
    const corrupt = {
      ...current,
      steps: [
        {
          ...current.steps[0],
          result_refs: [{ resource_key: 'providers', id: '8' }],
        },
      ],
    };
    await expect(
      tool.verifyResultAuthority!(input, corrupt, f.context),
    ).rejects.toThrow('nodia_ai:invalid_tool_output');
    await expect(
      tool.verifyResultAuthority!(
        input,
        { ...current, steps: [{ ...current.steps[0], step_id: randomUUID() }] },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_output');
  });
  it('projects minimal attachment metadata, preserving actual zero and null without content I/O', async () => {
    const f = fixture(),
      id = randomUUID();
    const result = await f
      .tool('nodia_attachments_describe')
      .handler({ attachment_id: id }, f.context);
    expect(result).toEqual({
      attachment_id: id,
      kind: 'audio',
      state: 'ready',
      media_type: 'audio/webm',
      byte_count: 0,
      page_count: null,
      duration_seconds: 0,
    });
    expect(f.attachments.getInTransaction).toHaveBeenCalledWith(
      f.manager,
      { userId: f.actor.actorId, sessionId: f.actor.sessionId },
      id,
      f.chat.id,
    );
  });
  it('lists own native preferences for super_admin, maintaining cursor semantics without mutation', async () => {
    const f = fixture();
    f.prefs.actor.isSuperAdmin = true;
    const row = f.prefs.seed();
    const context = {
      ...f.context,
      manager: f.prefs.manager,
      actor: f.prefs.actor,
    };
    const result = await f.tool('nodia_preferences_list').handler({}, context);
    expect(result.items).toMatchObject([
      { preference_id: row.id, value: '7', available: true },
    ]);
    expect(result).not.toHaveProperty('owner_id');
    expect(f.prefs.store.list).toHaveBeenCalledWith(
      f.prefs.manager,
      f.prefs.actor.actorId,
    );
  });
  it('denies stored preference values after change, removal or authority loss instead of returning stale data', async () => {
    const f = fixture(),
      row = f.prefs.seed(),
      tool = f.tool('nodia_preferences_list'),
      context = {
        ...f.context,
        manager: f.prefs.manager,
        actor: f.prefs.actor,
      };
    const result = await tool.handler({}, context);
    await tool.verifyResultAuthority!({}, result, context);
    row.revision++;
    await expect(
      tool.verifyResultAuthority!({}, result, context),
    ).rejects.toThrow('nodia_ai:preference_not_found');
  });
  it('requires active backend transaction and conversation; abort prevents native work', async () => {
    const f = fixture(),
      tool = f.tool('nodia_attachments_describe'),
      input = { attachment_id: randomUUID() };
    await expect(
      tool.handler(input, { ...f.context, manager: {} as EntityManager }),
    ).rejects.toThrow('authorization:transaction_required');
    await expect(
      tool.handler(input, { ...f.context, conversationId: undefined }),
    ).rejects.toThrow('authorization:transaction_required');
    await expect(
      tool.handler(input, { ...f.context, signal: AbortSignal.abort() }),
    ).rejects.toThrow();
    expect(f.attachments.getInTransaction).not.toHaveBeenCalled();
  });
  it('rejects mismatched or private-field receipt results before recovery', async () => {
    const f = fixture(),
      id = randomUUID(),
      tool = f.tool('nodia_attachments_describe'),
      input = { attachment_id: id },
      result = await tool.handler(input, f.context);
    await expect(
      tool.verifyResultAuthority!(
        input,
        { ...result, storage_key: 'private' },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_output');
    await expect(
      tool.verifyResultAuthority!(
        input,
        { ...result, attachment_id: randomUUID() },
        f.context,
      ),
    ).rejects.toThrow('nodia_ai:invalid_tool_output');
  });
});
