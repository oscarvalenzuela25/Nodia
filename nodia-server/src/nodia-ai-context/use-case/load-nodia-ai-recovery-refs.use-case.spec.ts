import { ForbiddenException, NotFoundException, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import type { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import type { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { LoadNodiaAiRecoveryRefsUseCase } from './load-nodia-ai-recovery-refs.use-case.js';

const identity = { userId: '1', sessionId: 'session' };
const proposalRow = { kind: 'proposal', id: 'proposal', proposal_id: 'proposal', proposal_revision: 2, proposal_hash: null };
const executionRow = { kind: 'execution', id: 'execution', proposal_id: 'proposal', proposal_revision: 2, proposal_hash: 'a'.repeat(64) };
function fixture(rows: unknown[] = [proposalRow, executionRow], historical: unknown[] = [], historicalTotal = String(historical.length)) {
  const loaded = {
    proposal: { id: 'proposal', conversation_id: 'chat' },
    revision: { revision: 2, hash: 'a'.repeat(64), state: 'ready', expires_at: new Date('2026-10-19T00:00:00Z') },
    now: new Date('2026-10-18T00:00:00Z'),
    steps: [{ command_template: { private_secret: 'DO NOT RETURN' } }],
  };
  const status = {
    execution_id: 'execution', revision: 3, state: 'partially_completed', can_resume: true,
    observed_at: '2026-10-18T00:00:00Z',
    steps: [
      { step_id: 'step1', state: 'completed', result_refs: [{ resource_key: 'providers', id: '7' }], error: null },
      { step_id: 'step2', state: 'failed', result_refs: [], error: { message: 'DO NOT RETURN' } },
    ],
  };
  const proposals = { load: vi.fn(async () => loaded), execute: vi.fn() };
  const executions = { load: vi.fn(async () => status), execute: vi.fn() };
  const query = vi.fn(async (_sql: string, _parameters?: unknown[]) => [{
    pending: rows, historical, historical_total: historicalTotal,
  }]);
  const manager = { queryRunner: { isTransactionActive: true }, query } as unknown as EntityManager;
  const useCase = new LoadNodiaAiRecoveryRefsUseCase(
    proposals as unknown as GetNodiaAiProposalUseCase,
    executions as unknown as GetNodiaAiExecutionUseCase,
    { results: { json_collection_items: 128, list_default_rows: 25 } } as NodiaAiRuntimePolicy,
  );
  return { loaded, status, proposals, executions, query, manager, useCase };
}

describe('live operational references stay separate from a generated summary', () => {
  it('projects only exact current references and completed result IDs after native reauthorization', async () => {
    const f = fixture();
    const result = await f.useCase.load(f.manager, identity, 'chat');
    expect(result).toEqual({ schema_version: 1, historical_total: '0', historical_included: 0, historical_more: false, historical_references: [], pending_references: [
      { kind: 'proposal', proposal_id: 'proposal', revision: 2, hash: 'a'.repeat(64), state: 'ready', expires_at: '2026-10-19T00:00:00.000Z' },
      { kind: 'execution', execution_id: 'execution', revision: 3, proposal_id: 'proposal', proposal_revision: 2,
        proposal_hash: 'a'.repeat(64), state: 'partially_completed', steps: [
          { step_id: 'step1', state: 'completed', result_refs: [{ resource_key: 'providers', id: '7' }] },
          { step_id: 'step2', state: 'failed', result_refs: [] },
        ] },
    ] });
    expect(JSON.stringify(result)).not.toContain('DO NOT RETURN');
    expect(JSON.stringify(result)).not.toContain('observed_at');
    expect(JSON.stringify(result)).not.toContain('can_resume');
    expect(f.proposals.load).toHaveBeenCalledWith(f.manager, identity, 'proposal', 'read');
    expect(f.executions.load).toHaveBeenCalledWith(f.manager, identity, 'execution');
    expect(f.proposals.execute).not.toHaveBeenCalled();
    expect(f.executions.execute).not.toHaveBeenCalled();
    expect(f.query.mock.calls[0]?.[1]).toEqual(['chat', 129, 25]);
  });
  it('exposes expiry from the authorized database time without changing the proposal', async () => {
    const f = fixture([proposalRow]);
    f.loaded.now = new Date('2026-10-20T00:00:00Z');
    expect((await f.useCase.load(f.manager, identity, 'chat')).pending_references[0]).toMatchObject({ state: 'expired' });
    expect(f.loaded.revision.state).toBe('ready');
  });
  it('does not relabel an already confirmed proposal because its former challenge expired', async () => {
    const f = fixture([proposalRow]);
    f.loaded.revision.state = 'confirmed';
    f.loaded.now = new Date('2026-10-20T00:00:00Z');
    expect((await f.useCase.load(f.manager, identity, 'chat')).pending_references[0]).toMatchObject({ state: 'confirmed' });
  });
  it('retains explicit restricted references when current domain authority or visibility disappears', async () => {
    const f = fixture();
    f.proposals.load.mockRejectedValueOnce(new ForbiddenException('private message'));
    f.executions.load.mockRejectedValueOnce(new NotFoundException('private message'));
    await expect(f.useCase.load(f.manager, identity, 'chat')).resolves.toEqual({ schema_version: 1, historical_total: '0', historical_included: 0, historical_more: false, historical_references: [], pending_references: [
      { kind: 'restricted', reference_kind: 'proposal', id: 'proposal' },
      { kind: 'restricted', reference_kind: 'execution', id: 'execution' },
    ] });
  });
  it.each([new UnauthorizedException('session expired'), new ServiceUnavailableException('unavailable'), new Error('corrupt')])(
    'propagates session, infrastructure and integrity failures instead of making restricted success', async (error) => {
      const f = fixture([proposalRow]);
      f.proposals.load.mockRejectedValueOnce(error);
      await expect(f.useCase.load(f.manager, identity, 'chat')).rejects.toBe(error);
    },
  );
  it('rejects more than 128 pending references without silently dropping an unresolved operation', async () => {
    const f = fixture(Array(129).fill(proposalRow));
    await expect(f.useCase.load(f.manager, identity, 'chat')).rejects.toThrow('nodia_ai:context_limit');
    expect(f.proposals.load).not.toHaveBeenCalled();
    expect(f.executions.load).not.toHaveBeenCalled();
  });
  it('allows 130 historical terminal references through an explicit recent page instead of blocking the chat', async () => {
    const f = fixture([], Array(25).fill(proposalRow), '130');
    f.loaded.revision.state = 'confirmed';
    const result = await f.useCase.load(f.manager, identity, 'chat');
    expect(result).toMatchObject({ historical_total: '130', historical_included: 25, historical_more: true });
    expect(result.pending_references).toHaveLength(0);
    expect(result.historical_references).toHaveLength(25);
    expect(f.proposals.load).toHaveBeenCalledTimes(25);
  });
  it('keeps all pending references in addition to the recent historical page', async () => {
    const f = fixture(Array(128).fill(proposalRow), Array(25).fill(executionRow), '130');
    const result = await f.useCase.load(f.manager, identity, 'chat');
    expect(result.pending_references).toHaveLength(128);
    expect(result.historical_references).toHaveLength(25);
    expect(result).toMatchObject({ historical_total: '130', historical_included: 25, historical_more: true });
    expect(f.proposals.load).toHaveBeenCalledTimes(128);
    expect(f.executions.load).toHaveBeenCalledTimes(25);
  });
  it('reports a fully included historical index explicitly', async () => {
    const f = fixture([], [executionRow]);
    await expect(f.useCase.load(f.manager, identity, 'chat')).resolves.toMatchObject({
      historical_total: '1', historical_included: 1, historical_more: false,
    });
  });
  it('accepts empty references as an explicit empty collection', async () => {
    const f = fixture([]);
    await expect(f.useCase.load(f.manager, identity, 'chat')).resolves.toEqual({ schema_version: 1, pending_references: [], historical_references: [],
      historical_total: '0', historical_included: 0, historical_more: false });
  });
  it('refuses a mismatched authorized proposal rather than returning another chat reference', async () => {
    const f = fixture([proposalRow]);
    f.loaded.proposal.conversation_id = 'another chat';
    await expect(f.useCase.load(f.manager, identity, 'chat')).rejects.toThrow('nodia_ai:invalid_persisted_state');
  });
  it('refuses a mismatched execution result', async () => {
    const f = fixture([executionRow]);
    f.status.execution_id = 'another execution';
    await expect(f.useCase.load(f.manager, identity, 'chat')).rejects.toThrow('nodia_ai:invalid_persisted_state');
  });
  it('requires the caller transaction before reading any reference', async () => {
    const f = fixture();
    Object.assign(f.manager.queryRunner!, { isTransactionActive: false });
    await expect(f.useCase.load(f.manager, identity, 'chat')).rejects.toThrow('authorization:transaction_required');
    expect(f.query).not.toHaveBeenCalled();
  });
});
