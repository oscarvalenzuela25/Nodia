import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import type { NodiaAiProposalService } from '../../nodia-ai-proposal/nodia-ai-proposal.service.js';
import type { ProposalPreparerContext } from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import type { NodiaAiExecutionService } from '../../nodia-ai-execution/nodia-ai-execution.service.js';
import type { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import type { NodiaAiDeletionJournalPort } from '../../nodia-ai-recovery/types/deletion-journal.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/prepare-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import { ValidateNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { NodiaAiConfirmationAvailabilityUseCase } from '../../nodia-ai-confirmation/use-case/nodia-ai-confirmation-availability.use-case.js';
import { ExecuteNodiaAiLocalEffectUseCase } from '../../nodia-ai-native-effect/use-case/execute-nodia-ai-local-effect.use-case.js';
import { ExecuteNodiaAiLocalExecutionUseCase } from '../../nodia-ai-execution/use-case/execute-nodia-ai-local-execution.use-case.js';
import type { ExecuteNodiaAiFinanceEffectUseCase } from '../../nodia-ai-finance-effect/use-case/execute-nodia-ai-finance-effect.use-case.js';
import { proposalFixture } from '../../nodia-ai-proposal/use-case/proposal.fixture.js';
import { loadNodiaAiWriteContracts } from '../../nodia-ai-write-tools/types/write-tool-contract.types.js';
import { MutateSaleUseCase } from '../../sale/use-case/mutate-sale.use-case.js';
import { NodiaAiSalesModule } from '../nodia-ai-sales.module.js';
import { BuildNodiaAiHistoricalSalesReadersUseCase } from './build-nodia-ai-historical-sales-readers.use-case.js';

const business = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const f = proposalFixture();
  const readers = new BuildNodiaAiHistoricalSalesReadersUseCase()
    .historicalReaders;
  const reader = readers[0];
  f.actor.modules[0].route = '/business';
  Object.assign(f.step, {
    tool_name: reader.toolName,
    effect_key: 'sales.create',
    scope: { business_id: business },
    command_template: {
      business_id: business,
      id: null,
      command: { items: [] },
      defaulted_payment_method: true,
    },
  });
  Object.assign(f.step.public_step, {
    tool_name: f.step.tool_name,
    effect_key: f.step.effect_key,
    scope: f.step.scope,
  });
  f.revision.catalog_version = reader.catalogVersion;
  const common = readFileSync(
    new URL(
      '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
      import.meta.url,
    ),
    'utf8',
  );
  const canonical = new CanonicalizeNodiaAiProposalUseCase(f.policy);
  // Seal an old snapshot once using its old trusted registration, then remove it.
  const old = new ValidateNodiaAiProposalUseCase(
    [
      {
        ...f.preparer,
        toolName: f.step.tool_name,
        catalogVersion: reader.catalogVersion,
      },
    ],
    common,
    f.policy,
    canonical,
  );
  f.revision.hash = String(
    old.compile(f.proposal, f.revision, [f.step], false).hash,
  );
  const validate = new ValidateNodiaAiProposalUseCase(
    [],
    common,
    f.policy,
    canonical,
    readers,
  );
  const state = { visible: true };
  vi.mocked(f.manager.query).mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT u.id'))
      return [
        {
          actorId: f.actor.actorId,
          sessionId: f.actor.sessionId,
          isSuperAdmin: false,
        },
      ];
    if (sql.startsWith('SELECT id::text FROM businesses'))
      return [{ id: business }];
    if (sql.includes('FROM businesses nodia_scope_business'))
      return state.visible ? [{ id: business }] : [];
    return [];
  });
  const get = new GetNodiaAiProposalUseCase(
    f.store as unknown as NodiaAiProposalService,
    f.authorize as unknown as AuthorizeNodiaAiUseCase,
    f.authorizeChat as unknown as AuthorizeNodiaAiConversationUseCase,
    validate,
    f.policy,
  );
  return { ...f, readers, reader, validate, canonical, get, state };
}

describe('Retired conversational sales writers', () => {
  it('constructs the historical-only Nest module without a Sale writer and exports no sales write contract', async () => {
    const module = await Test.createTestingModule({
      imports: [NodiaAiSalesModule],
    }).compile();
    try {
      expect(
        module.get(BuildNodiaAiHistoricalSalesReadersUseCase).historicalReaders,
      ).toHaveLength(5);
      expect(() => module.get(MutateSaleUseCase)).toThrow();
      expect(
        loadNodiaAiWriteContracts()
          .flatMap((bundle) => bundle.tools)
          .some(
            (tool) =>
              tool.resource_key === 'sales' ||
              tool.tool_name.startsWith('nodia_sales_prepare_'),
          ),
      ).toBe(false);
    } finally {
      await module.close();
    }
  });

  it('reads an immutable ready sale proposal as invalidated, rechecks business visibility and rejects a tampered envelope', async () => {
    const f = fixture();
    const frozen = JSON.stringify([f.proposal, f.revision, f.step]);
    expect(await f.get.execute(f.identity, f.proposal.id)).toMatchObject({
      hash: f.revision.hash,
      state: 'invalidated',
    });
    expect(JSON.stringify([f.proposal, f.revision, f.step])).toBe(frozen);
    f.state.visible = false;
    await expect(f.get.execute(f.identity, f.proposal.id)).rejects.toThrow(
      'business:resource_not_found',
    );
    f.state.visible = true;
    f.step.command_template.business_id = randomUUID();
    await expect(f.get.execute(f.identity, f.proposal.id)).rejects.toThrow(
      'nodia_ai:invalid_persisted_state',
    );
  });

  it('cannot prepare, edit or authorize an old sales reader, even when its historical name and hash are known', async () => {
    const f = fixture();
    const context = {
      manager: f.manager,
      actor: f.actor,
      conversationId: f.chat.id,
      moduleRoutes: ['/business'],
    } as ProposalPreparerContext;
    const stored = {
      id: f.step.id,
      toolName: f.step.tool_name,
      contractHash: f.step.contract_hash,
      position: 1,
      commandTemplate: f.step.command_template,
      scope: f.step.scope,
      preconditions: f.step.preconditions,
      publicStep: f.step.public_step,
      outputBindings: [],
    };
    vi.mocked(f.manager.query).mockClear();
    for (const reader of f.readers) {
      expect(() => f.validate.preparer(reader.toolName)).toThrow(
        'nodia_ai:catalog_changed',
      );
      await expect(reader.prepare({}, context)).rejects.toThrow(
        'nodia_ai:catalog_changed',
      );
      await expect(reader.applyEdits({}, [], context)).rejects.toThrow(
        'nodia_ai:catalog_changed',
      );
      await expect(reader.verifyAuthority(stored, context)).rejects.toThrow(
        'nodia_ai:catalog_changed',
      );
      await expect(reader.verifyPreconditions(stored, context)).rejects.toThrow(
        'nodia_ai:catalog_changed',
      );
      expect('executeConfirmed' in reader).toBe(false);
    }
    expect(f.manager.query).not.toHaveBeenCalled();
    const available = new NodiaAiConfirmationAvailabilityUseCase([]);
    expect(
      available.describe([f.step], f.revision.catalog_version).can_confirm,
    ).toBe(false);
    await expect(
      f.get.load(f.manager, f.identity, f.proposal.id, 'write'),
    ).rejects.toThrow('nodia_ai:catalog_changed');
    const prepare = new PrepareNodiaAiProposalUseCase(
      f.store as unknown as NodiaAiProposalService,
      f.authorizeChat as unknown as AuthorizeNodiaAiConversationUseCase,
      f.authorize as unknown as AuthorizeNodiaAiUseCase,
      f.validate,
      f.policy,
    );
    await expect(
      prepare.execute(f.manager, f.identity, {
        conversationId: f.chat.id,
        toolName: f.step.tool_name,
        partial: { business_id: business },
      }),
    ).rejects.toThrow('nodia_ai:catalog_changed');
    expect(f.store.publishReady).not.toHaveBeenCalled();
  });

  it('rejects an already queued old sale before a native effect or receipt can be dispatched', async () => {
    const f = fixture();
    f.revision.state = 'confirmed';
    const executeFinance = vi.fn();
    const effect = new ExecuteNodiaAiLocalEffectUseCase(
      {
        execute: executeFinance,
      } as unknown as ExecuteNodiaAiFinanceEffectUseCase,
      [],
    );
    const effectSpy = vi.spyOn(effect, 'execute');
    const executionId = randomUUID();
    const store = {
      transaction: async <T>(work: (manager: EntityManager) => Promise<T>) =>
        work(f.manager),
      requiresExclusiveAuthority: async () => false,
      execution: async () => ({
        id: executionId,
        proposal_id: f.proposal.id,
        conversation_id: f.chat.id,
      }),
      complete: vi.fn(),
    };
    const subject = new ExecuteNodiaAiLocalExecutionUseCase(
      store as unknown as NodiaAiExecutionService,
      f.get,
      {} as GetNodiaAiExecutionUseCase,
      f.validate,
      f.canonical,
      effect,
      f.policy,
      {} as NodiaAiDeletionJournalPort,
    );
    await expect(subject.execute(f.identity, executionId)).rejects.toThrow(
      'nodia_ai:catalog_changed',
    );
    expect(effectSpy).not.toHaveBeenCalled();
    expect(executeFinance).not.toHaveBeenCalled();
    expect(store.complete).not.toHaveBeenCalled();
    const stored = {
      id: f.step.id,
      toolName: f.step.tool_name,
      contractHash: f.step.contract_hash,
      position: 1,
      commandTemplate: f.step.command_template,
      scope: f.step.scope,
      preconditions: f.step.preconditions,
      publicStep: f.step.public_step,
      outputBindings: [],
    };
    expect(() => effect.execute(stored, {} as ProposalPreparerContext)).toThrow(
      'nodia_ai:catalog_changed',
    );
  });
});
