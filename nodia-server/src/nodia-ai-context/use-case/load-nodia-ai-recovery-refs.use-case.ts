import { Inject, Injectable, InternalServerErrorException, HttpException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import { NODIA_AI_RUNTIME_POLICY, type NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiKnownPreDispatchError } from '../../nodia-ai-runtime/types/worker.types.js';

export type NodiaAiRecoveryReference =
  | { kind: 'proposal'; proposal_id: string; revision: number; hash: string; state: string; expires_at: string }
  | { kind: 'execution'; execution_id: string; revision: number; proposal_id: string; proposal_revision: number;
      proposal_hash: string; state: string; steps: { step_id: string; state: string;
        result_refs: { resource_key: string; id: string }[] }[] }
  | { kind: 'restricted'; reference_kind: 'proposal' | 'execution'; id: string };
export type NodiaAiRecoveryReferences = {
  schema_version: 1;
  pending_references: NodiaAiRecoveryReference[];
  historical_references: NodiaAiRecoveryReference[];
  historical_total: string; historical_included: number; historical_more: boolean;
};
interface RecoveryRow {
  kind: 'proposal' | 'execution'; id: string;
  proposal_id: string; proposal_revision: number; proposal_hash: string;
}

/** Preserves live operation references; summary text never proves confirmation or an effect. */
@Injectable()
export class LoadNodiaAiRecoveryRefsUseCase {
  constructor(
    private readonly proposals: GetNodiaAiProposalUseCase,
    private readonly executions: GetNodiaAiExecutionUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY) private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  async load(manager: EntityManager, identity: NodiaAiActorReference, conversationId: string): Promise<NodiaAiRecoveryReferences> {
    if (!manager.queryRunner?.isTransactionActive)
      throw new InternalServerErrorException('authorization:transaction_required');
    const limit = this.policy.results.json_collection_items;
    const historicalLimit = this.policy.results.list_default_rows;
    const [batch]: { pending: RecoveryRow[]; historical: RecoveryRow[]; historical_total: string }[] = await manager.query(
      `WITH refs AS (
        SELECT 'proposal'::text AS kind,p.id,p.id AS proposal_id,p.current_revision AS proposal_revision,
          NULL::text AS proposal_hash,p.created_at,
          COALESCE(v.state='draft' OR (v.state='ready' AND v.expires_at>statement_timestamp()),false) AS pending
        FROM nodia_ai_proposals p LEFT JOIN nodia_ai_proposal_revisions v
          ON v.proposal_id=p.id AND v.revision=p.current_revision WHERE p.conversation_id=$1
        UNION ALL
        SELECT 'execution'::text AS kind,e.id,e.origin_proposal_id AS proposal_id,
          e.origin_proposal_revision AS proposal_revision,e.proposal_hash,e.created_at,
          (e.completed_at IS NULL AND e.state NOT IN ('completed','cancelled')) AS pending
        FROM nodia_ai_executions e WHERE e.conversation_id=$1
      ), pending AS (
        SELECT * FROM refs WHERE pending ORDER BY created_at,kind,id LIMIT $2
      ), historical AS (
        SELECT * FROM refs WHERE NOT pending ORDER BY created_at DESC,kind DESC,id DESC LIMIT $3
      )
      SELECT COALESCE((SELECT jsonb_agg(to_jsonb(p)-'created_at'-'pending' ORDER BY p.created_at,p.kind,p.id) FROM pending p),'[]'::jsonb) AS pending,
        COALESCE((SELECT jsonb_agg(to_jsonb(h)-'created_at'-'pending' ORDER BY h.created_at DESC,h.kind DESC,h.id DESC) FROM historical h),'[]'::jsonb) AS historical,
        (SELECT count(*)::text FROM refs WHERE NOT pending) AS historical_total`,
      [conversationId, limit + 1, historicalLimit],
    );
    if (!batch || !Array.isArray(batch.pending) || !Array.isArray(batch.historical) ||
      typeof batch.historical_total !== 'string' || !/^(0|[1-9][0-9]*)$/.test(batch.historical_total) ||
      batch.historical.length > historicalLimit || BigInt(batch.historical_total) < BigInt(batch.historical.length))
      throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
    if (batch.pending.length > limit) throw new NodiaAiKnownPreDispatchError('nodia_ai:context_limit');
    const rows = [...batch.pending, ...batch.historical];
    const references: NodiaAiRecoveryReference[] = [];
    for (const row of rows) {
      try {
        if (row.kind === 'proposal') {
          const loaded = await this.proposals.load(manager, identity, row.id, 'read');
          if (loaded.proposal.id !== row.id || loaded.proposal.conversation_id !== conversationId)
            throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
          references.push({
            kind: 'proposal', proposal_id: loaded.proposal.id,
            revision: loaded.revision.revision, hash: loaded.revision.hash,
            state: loaded.revision.state === 'ready' && loaded.now >= loaded.revision.expires_at
              ? 'expired' : loaded.revision.state,
            expires_at: loaded.revision.expires_at.toISOString(),
          });
        } else if (row.kind === 'execution') {
          const result = await this.executions.load(manager, identity, row.id);
          if (result.execution_id !== row.id)
            throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
          references.push({
            kind: 'execution', execution_id: result.execution_id, revision: result.revision,
            proposal_id: row.proposal_id, proposal_revision: row.proposal_revision,
            proposal_hash: row.proposal_hash, state: result.state,
            steps: result.steps.map((step) => ({ step_id: step.step_id, state: step.state,
              result_refs: step.result_refs.map((ref) => ({ resource_key: ref.resource_key, id: ref.id })) })),
          });
        } else throw new InternalServerErrorException('nodia_ai:invalid_persisted_state');
      } catch (error: unknown) {
        if (error instanceof HttpException && [403, 404].includes(error.getStatus())) {
          references.push({ kind: 'restricted', reference_kind: row.kind, id: row.id });
        } else throw error;
      }
    }
    return { schema_version: 1,
      pending_references: references.slice(0, batch.pending.length),
      historical_references: references.slice(batch.pending.length),
      historical_total: batch.historical_total,
      historical_included: batch.historical.length,
      historical_more: BigInt(batch.historical_total) > BigInt(batch.historical.length),
    };
  }
}
