import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { NodiaAiProposal } from './entities/nodia-ai-proposal.entity.js';
import { NodiaAiProposalRevision } from './entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from './entities/nodia-ai-proposal-step.entity.js';
import { NodiaAiDraft } from './entities/nodia-ai-draft.entity.js';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { appendNodiaAiEvent } from '../nodia-ai-run/event-journal.js';
@Injectable()
export class NodiaAiProposalService {
  constructor(private readonly source: DataSource) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>) {
    return this.source.transaction(work);
  }
  proposal(manager: EntityManager, id: string) {
    return manager.getRepository(NodiaAiProposal).findOneBy({ id });
  }
  revision(manager: EntityManager, id: string, revision: number) {
    return manager
      .getRepository(NodiaAiProposalRevision)
      .findOneBy({ proposal_id: id, revision });
  }
  steps(manager: EntityManager, id: string, revision: number) {
    return manager.getRepository(NodiaAiProposalStep).find({
      where: { proposal_id: id, proposal_revision: revision },
      order: { position: 'ASC' },
    });
  }
  async storeRevision(
    manager: EntityManager,
    revision: NodiaAiProposalRevision,
    steps: NodiaAiProposalStep[],
  ) {
    await manager
      .getRepository(NodiaAiProposalRevision)
      .insert({ ...revision, state: 'draft' });
    await manager.query(
      `INSERT INTO nodia_ai_proposal_steps (id,proposal_id,proposal_revision,position,tool_name,contract_hash,kind,effect_key,scope,command_template,public_step,output_bindings,preconditions)
      SELECT id,proposal_id,proposal_revision,position,tool_name,contract_hash,kind,effect_key,scope,command_template,public_step,output_bindings,preconditions
      FROM jsonb_to_recordset($1::jsonb) AS x(id uuid,proposal_id uuid,proposal_revision integer,position integer,tool_name text,contract_hash char(64),kind text,effect_key text,scope jsonb,command_template jsonb,public_step jsonb,output_bindings jsonb,preconditions jsonb)`,
      [JSON.stringify(steps)],
    );
    await manager
      .getRepository(NodiaAiProposalRevision)
      .update(
        { proposal_id: revision.proposal_id, revision: revision.revision },
        { state: revision.state },
      );
  }
  async create(
    manager: EntityManager,
    proposal: NodiaAiProposal,
    revision: NodiaAiProposalRevision,
    steps: NodiaAiProposalStep[],
  ) {
    await manager.getRepository(NodiaAiProposal).insert(proposal);
    await this.storeRevision(manager, revision, steps);
  }
  async advance(
    manager: EntityManager,
    proposal: NodiaAiProposal,
    revision: NodiaAiProposalRevision,
    steps: NodiaAiProposalStep[],
  ) {
    await manager
      .getRepository(NodiaAiProposalRevision)
      .update(
        { proposal_id: proposal.id, revision: proposal.current_revision },
        { state: 'superseded' },
      );
    await this.storeRevision(manager, revision, steps);
    await manager
      .getRepository(NodiaAiProposal)
      .update(
        { id: proposal.id, current_revision: proposal.current_revision },
        { current_revision: revision.revision },
      );
  }
  insertDraft(manager: EntityManager, draft: NodiaAiDraft) {
    return manager.query(
      `INSERT INTO nodia_ai_drafts (id,conversation_id,actor_id,tool_call_id,tool_name,catalog_version,revision,scope,partial_command,clarifications,state,claimed_proposal_id,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        draft.id,
        draft.conversation_id,
        draft.actor_id,
        draft.tool_call_id,
        draft.tool_name,
        draft.catalog_version,
        draft.revision,
        draft.scope,
        draft.partial_command,
        draft.clarifications,
        draft.state,
        draft.claimed_proposal_id,
        draft.created_at,
        draft.updated_at,
      ],
    );
  }
  /** The chat is already locked. Lock draft rows in UUID order, independent of execution order. */
  lockWorkflowDrafts(
    manager: EntityManager,
    chatId: string,
    ids: readonly string[],
  ) {
    return manager
      .getRepository(NodiaAiDraft)
      .createQueryBuilder('draft')
      .where('draft.conversation_id = :chatId', { chatId })
      .andWhere('draft.id IN (:...ids)', { ids: [...ids].sort() })
      .orderBy('draft.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
  }
  async claimWorkflowDrafts(
    manager: EntityManager,
    drafts: readonly NodiaAiDraft[],
    proposalId: string,
    now: Date,
  ) {
    for (const draft of drafts) {
      const claimed = await manager
        .getRepository(NodiaAiDraft)
        .update(
          {
            id: draft.id,
            revision: draft.revision,
            state: draft.state,
            conversation_id: draft.conversation_id,
            actor_id: draft.actor_id,
          },
          {
            state: 'claimed',
            claimed_proposal_id: proposalId,
            revision: draft.revision + 1,
            updated_at: now,
          },
        );
      if (claimed.affected !== 1)
        throw new ConflictException('nodia_ai:revision_conflict');
    }
  }
  async publishReady(
    manager: EntityManager,
    proposal: NodiaAiProposal,
    projection: NodiaAiJsonObject,
    routes: readonly string[],
    maxEvents: number,
  ) {
    const rows: { run_id: string }[] = await manager.query(
      `SELECT t.run_id FROM nodia_ai_drafts d
      JOIN nodia_ai_tool_calls t ON t.id=d.tool_call_id AND t.conversation_id=d.conversation_id
      JOIN nodia_ai_runs r ON r.id=t.run_id AND r.conversation_id=d.conversation_id
      WHERE d.claimed_proposal_id=$1 AND d.conversation_id=$2 AND r.actor_id=$3 ORDER BY d.created_at,d.id LIMIT 1`,
      [proposal.id, proposal.conversation_id, proposal.actor_id],
    );
    if (!rows.length) return;
    await appendNodiaAiEvent(manager, {
      conversationId: proposal.conversation_id,
      runId: rows[0].run_id,
      eventKey: `proposal:${proposal.id}:${projection.revision}:ready`,
      kind: 'proposal_ready',
      payload: {
        proposal_id: proposal.id,
        revision: projection.revision,
        hash: projection.hash,
      },
      moduleRoutes: routes,
      maxEvents,
    });
  }
}
