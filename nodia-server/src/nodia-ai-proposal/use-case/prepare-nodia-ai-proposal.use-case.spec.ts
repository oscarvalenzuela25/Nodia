import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';
import { FinanceLedgerService } from '../../finance-obligation/finance-ledger.service.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import type { AuthorizeNodiaAiConversationUseCase } from '../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { NodiaAiDraft } from '../entities/nodia-ai-draft.entity.js';
import type { NodiaAiProposal } from '../entities/nodia-ai-proposal.entity.js';
import type { NodiaAiProposalRevision } from '../entities/nodia-ai-proposal-revision.entity.js';
import type { NodiaAiProposalStep } from '../entities/nodia-ai-proposal-step.entity.js';
import type { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import { PrepareNodiaAiFinanceMovementUseCase } from './prepare-nodia-ai-finance-movement.use-case.js';
import { PrepareNodiaAiProposalUseCase } from './prepare-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from './canonicalize-nodia-ai-proposal.use-case.js';
import { ValidateNodiaAiProposalUseCase } from './validate-nodia-ai-proposal.use-case.js';
import { proposalFixture } from './proposal.fixture.js';
function fixture() {
  const f = proposalFixture();
  let draft: NodiaAiDraft | null = null;
  const domainSave = vi.fn(() => {
    throw new Error('No business effect allowed');
  });
  const savedSteps: NodiaAiProposalStep[] = [];
  Object.assign(f.manager, {
    query: vi.fn(async (sql: string) =>
      sql.startsWith('SELECT u.id')
        ? [
            {
              actorId: f.actor.actorId,
              sessionId: f.actor.sessionId,
              isSuperAdmin: false,
            },
          ]
        : [],
    ),
    getRepository: (type: unknown) =>
      type === NodiaAiDraft
        ? {
            findOneBy: vi.fn(async () => draft),
            save: vi.fn(async (next: NodiaAiDraft) => {
              draft = next;
              return next;
            }),
          }
        : {
            findOne: vi.fn(async () =>
              Object.assign(new FinanceCategory(), {
                id: '7',
                user_id: '1',
                name: 'Comida',
                key: 'food',
                is_active: true,
                updated_at: f.now,
              }),
            ),
            save: domainSave,
          },
  });
  const source = {
    transaction: () => {
      throw new Error('No independent transaction');
    },
  } as unknown as DataSource;
  const preparer = new PrepareNodiaAiFinanceMovementUseCase(
    new FinanceLedgerService(source),
  );
  f.actor.modules[0].route = preparer.moduleRoutes[0];
  const prepareSpy = vi.spyOn(preparer, 'prepare');
  const validate = new ValidateNodiaAiProposalUseCase(
    [preparer],
    readFileSync(
      new URL(
        '../../../../docs/mvp/nodia-ai-v1-common-contracts.schema.json',
        import.meta.url,
      ),
      'utf8',
    ),
    f.policy,
    new CanonicalizeNodiaAiProposalUseCase(f.policy),
  );
  const store = {
    insertDraft: vi.fn(async (_manager: unknown, next: NodiaAiDraft) => {
      draft = next;
    }),
    create: vi.fn(
      async (
        _manager: unknown,
        _proposal: NodiaAiProposal,
        _revision: NodiaAiProposalRevision,
        steps: NodiaAiProposalStep[],
      ) => {
        savedSteps.push(...steps);
      },
    ),
    publishReady: vi.fn(),
  };
  const prepare = new PrepareNodiaAiProposalUseCase(
    store as unknown as NodiaAiProposalService,
    f.authorizeChat as unknown as AuthorizeNodiaAiConversationUseCase,
    f.authorize as unknown as AuthorizeNodiaAiUseCase,
    validate,
    f.policy,
  );
  const initial: NodiaAiJsonObject = {
    name: 'Comida',
    amount: '20000',
    category_id: '7',
    type: 'expense',
  };
  const base = { conversationId: f.chat.id, toolName: preparer.toolName };
  return {
    ...f,
    store,
    preparer,
    prepareSpy,
    prepare,
    initial,
    base,
    draft: () => draft,
    savedSteps,
    domainSave,
  };
}
describe('Continue a persisted NodiaAI draft with a clarification reply', () => {
  it('rejects a caller-supplied backend envelope before reaching a domain preparer', async () => {
    const f = fixture();
    await expect(f.prepare.execute(f.manager, f.identity, {
      ...f.base, partial: { schema_version: 1, command: { name: 'Spoofed' }, origins: {} },
    })).rejects.toThrow('nodia_ai:invalid_input');
    expect(f.prepareSpy).not.toHaveBeenCalled();
    expect(f.savedSteps).toHaveLength(0);
  });
  it('accepts only status and preserves previously collected financial fields and draft identity', async () => {
    const f = fixture();
    const first = await f.prepare.execute(f.manager, f.identity, {
      ...f.base,
      partial: f.initial,
    });
    expect(first.status).toBe('needs_clarification');
    expect(first.missing_fields).toEqual(['status']);
    const previous = structuredClone(f.draft()!.partial_command);
    const second = await f.prepare.execute(f.manager, f.identity, {
      ...f.base,
      partial: { status: 'paid' },
      draftId: String(first.draft_id),
      expectedDraftRevision: 1,
    });
    expect(second.status).toBe('ready');
    expect(second.draft_id).toBe(first.draft_id);
    expect(f.prepareSpy.mock.calls[1][2]).toEqual(previous);
    expect(f.savedSteps[0].command_template.command).toMatchObject({
      name: 'Comida',
      amount: '20000',
      category_id: '7',
      type: 'expense',
      status: 'paid',
    });
    expect(f.draft()!.partial_command).toEqual(
      f.savedSteps[0].command_template,
    );
    expect(f.draft()!.revision).toBe(2);
    expect(f.domainSave).not.toHaveBeenCalled();
  });
  it('persists combined partial state over multiple clarification replies without losing prior values', async () => {
    const f = fixture();
    const first = await f.prepare.execute(f.manager, f.identity, {
      ...f.base,
      partial: { name: 'Comida' },
    });
    const second = await f.prepare.execute(f.manager, f.identity, {
      ...f.base,
      partial: { amount: '20000' },
      draftId: String(first.draft_id),
      expectedDraftRevision: 1,
    });
    expect(second.status).toBe('needs_clarification');
    expect(f.draft()!.partial_command.command).toMatchObject({
      name: 'Comida',
      amount: '20000',
    });
    const third = await f.prepare.execute(f.manager, f.identity, {
      ...f.base,
      partial: { category_id: '7', type: 'expense', status: 'pending' },
      draftId: String(first.draft_id),
      expectedDraftRevision: 2,
    });
    expect(third.status).toBe('ready');
    expect(third.draft_id).toBe(first.draft_id);
    expect(f.savedSteps[0].command_template.command).toMatchObject({
      name: 'Comida',
      amount: '20000',
      status: 'pending',
    });
    expect(f.domainSave).not.toHaveBeenCalled();
  });
  it('rejects stale draft CAS as 409 before calling the domain preparer', async () => {
    const f = fixture();
    const first = await f.prepare.execute(f.manager, f.identity, {
      ...f.base,
      partial: f.initial,
    });
    const operation = f.prepare.execute(f.manager, f.identity, {
      ...f.base,
      partial: { status: 'paid' },
      draftId: String(first.draft_id),
      expectedDraftRevision: 2,
    });
    await expect(operation).rejects.toMatchObject({
      status: 409,
      message: 'nodia_ai:revision_conflict',
    });
    expect(f.prepareSpy).toHaveBeenCalledOnce();
    expect(f.draft()!.revision).toBe(1);
    expect(f.store.create).not.toHaveBeenCalled();
  });
});
