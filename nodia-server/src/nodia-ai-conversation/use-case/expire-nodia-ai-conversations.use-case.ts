import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { NodiaAiAttachmentService } from '../../nodia-ai-attachment/nodia-ai-attachment.service.js';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import {
  NODIA_AI_DELETION_JOURNAL,
  type NodiaAiDeletionJournalPort,
} from '../../nodia-ai-recovery/types/deletion-journal.js';

/** Called by maintenance independently of browser activity. No public endpoint and no replay of expired work. */
@Injectable()
export class ExpireNodiaAiConversationsUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Optional()
    @Inject(NodiaAiAttachmentService)
    private readonly attachments: NodiaAiAttachmentService | undefined,
    @Inject(NODIA_AI_DELETION_JOURNAL)
    private readonly deletionJournal: NodiaAiDeletionJournalPort,
  ) {}
  async execute() {
    const prepared = this.deletionJournal.enabled
      ? await this.conversations.transaction(async (manager) => {
          await lockAuthority(manager);
          await lockNodiaAiQueue(manager);
          const now = await this.conversations.now(manager);
          const chats = await this.selectChats(manager, now);
          return {
            now,
            entries: await this.captureGenerations(manager, chats),
          };
        })
      : null;
    if (prepared) {
      if (!prepared.entries.length)
        return { purged_chats: 0, unresolved_jobs: 0 };
      // Never retain the authority/queue locks while accessing the external store.
      // An uncertain ACK may leave an irreversible intent even when SQL never commits.
      await this.deletionJournal.recordDeletions({
        deleted_at: prepared.now.toISOString(),
        entries: prepared.entries,
      });
    }
    const purgedResources: {
      kind: 'conversation';
      conversation_id: string;
      storage_generations: string[];
    }[] = [];
    const result = await this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const now = await this.conversations.now(manager);
      const chats = await this.selectChats(
        manager,
        now,
        prepared?.entries.map((entry) => entry.conversation_id),
      );
      if (prepared) {
        const current = await this.captureGenerations(manager, chats);
        const recorded = new Map(
          prepared.entries.map((entry) => [
            entry.conversation_id,
            entry.storage_generations,
          ]),
        );
        for (const entry of current)
          if (
            JSON.stringify(recorded.get(entry.conversation_id)) !==
            JSON.stringify(entry.storage_generations)
          )
            throw Error('nodia_ai:deletion_journal_generation_changed');
      }
      let pending = 0;
      for (const chat of chats) {
        await manager.query(
          `UPDATE nodia_ai_conversations SET lifecycle='expiring',retention_epoch=retention_epoch+1,active_job_id=NULL WHERE id=$1`,
          [chat.id],
        );
        await manager.query(
          `UPDATE nodia_ai_execution_grants SET revoked_at=$2 WHERE (run_id IN (SELECT id FROM nodia_ai_runs WHERE conversation_id=$1) OR execution_id IN (SELECT id FROM nodia_ai_executions WHERE conversation_id=$1)) AND revoked_at IS NULL`,
          [chat.id, now],
        );
        await this.attachments?.scheduleChatCleanup(manager, chat.id, now);
        // Fence every holder before deleting its chat. A local timeout/TTL never attests remote completion.
        await manager.query(
          `UPDATE nodia_ai_runtime_slots SET state='unknown',fence=fence+1,conversation_id=NULL,job_id=NULL,updated_at=$2 WHERE conversation_id=$1 AND state<>'free'`,
          [chat.id, now],
        );
        // A paused attempt has ended, but its human-owned native login may still
        // be running. Preserve only that operational witness when content expires.
        await manager.query(
          `UPDATE nodia_ai_execution_steps s SET state='unknown' FROM nodia_ai_executions e
          WHERE s.execution_id=e.id AND e.conversation_id=$1
          AND s.recovery_descriptor->>'kind'='secure_human_flow'
          AND s.minimal_receipt IS NULL AND s.state IN ('waiting_for_user','unknown')
          AND (s.recovery_descriptor->>'status' IN ('invoking','pending','unknown')
            OR (s.recovery_descriptor->'native_reference' IS NOT NULL AND s.recovery_descriptor->'native_reference'<>'null'::jsonb))`,
          [chat.id],
        );
        await manager.query(
          `UPDATE nodia_ai_executions e SET state='unknown'
          WHERE e.conversation_id=$1 AND e.state IN ('waiting_for_user','unknown')
          AND EXISTS(SELECT 1 FROM nodia_ai_execution_steps s WHERE s.execution_id=e.id
            AND s.state='unknown' AND s.recovery_descriptor->>'kind'='secure_human_flow')`,
          [chat.id],
        );
        const jobs: {
          id: string;
          kind: string;
          state: string;
          unsafe: boolean;
        }[] = await manager.query(
          `SELECT j.id,j.kind,j.state, (j.state='unknown' OR EXISTS(
          SELECT 1 FROM nodia_ai_execution_steps s WHERE s.execution_id=j.execution_id
          AND s.recovery_descriptor->>'kind'='secure_human_flow'
          AND (s.state='unknown' OR (s.recovery_descriptor->>'status' IN ('completed','cancelled','expired','failed')
            AND s.recovery_descriptor->'native_request' IS NOT NULL AND s.recovery_descriptor->'native_request'<>'null'::jsonb))) OR (j.state NOT IN ('done','failed','cancelled') AND EXISTS (
          SELECT 1 FROM nodia_ai_job_attempts a WHERE a.job_id=j.id AND a.phase IN ('dispatch_armed','sent','unknown')))) AS unsafe
          FROM nodia_ai_jobs j WHERE j.conversation_id=$1 ORDER BY j.id FOR UPDATE`,
          [chat.id],
        );
        for (const job of jobs) {
          if (
            (job.kind === 'delete_blob' || job.kind === 'reconcile') &&
            job.state !== 'done'
          ) {
            pending++;
            // Generation-owned deletion/reconciliation must survive until verified, including exhausted cleanup retries.
            // Descriptor content is replaced; storage key/generation and attempt operation references remain operational identity.
            await manager.query(
              `UPDATE nodia_ai_jobs SET run_id=NULL,execution_id=NULL,conversation_id=NULL,
              recovery_descriptor=jsonb_strip_nulls(jsonb_build_object('schema_version',1,'reason',CASE WHEN stage_key='attachment_cleanup' THEN 'attachment_cleanup' ELSE 'chat_expired' END,'job_id',id::text,'retention_epoch',$2::text,'runtime',recovery_descriptor->'runtime','terminal_proof',recovery_descriptor->'terminal_proof','cleanup_attempts',recovery_descriptor->'cleanup_attempts','restore_quarantined',recovery_descriptor->'restore_quarantined') || CASE WHEN stage_key='attachment_cleanup' THEN jsonb_build_object('attachment_id',recovery_descriptor->'attachment_id','owner_id',recovery_descriptor->'owner_id','reserved_bytes',recovery_descriptor->'reserved_bytes','write_deadline_until',recovery_descriptor->'write_deadline_until') ELSE '{}'::jsonb END),updated_at=$3 WHERE id=$1`,
              [job.id, chat.retention_epoch, now],
            );
            await manager.query(
              `UPDATE nodia_ai_job_attempts SET selection_snapshot=NULL,routing_phase=NULL,error_code='chat_expired' WHERE job_id=$1`,
              [job.id],
            );
            continue;
          }
          if (job.unsafe || job.state === 'leased') {
            pending++;
            // Only operational identity survives; original prompt, model selection and grant are discarded.
            await manager.query(
              `UPDATE nodia_ai_jobs SET state='unknown',run_id=NULL,execution_id=NULL,conversation_id=NULL,fence=fence+1,
              recovery_descriptor=jsonb_strip_nulls(jsonb_build_object('schema_version',1,'reason','chat_expired','job_id',id::text,'execution_id',execution_id::text,'retention_epoch',$2::text,'runtime',recovery_descriptor->'runtime','terminal_proof',recovery_descriptor->'terminal_proof','cleanup_attempts',recovery_descriptor->'cleanup_attempts','restore_quarantined',recovery_descriptor->'restore_quarantined')),updated_at=$3 WHERE id=$1`,
              [job.id, chat.retention_epoch, now],
            );
            await manager.query(
              `UPDATE nodia_ai_job_attempts SET selection_snapshot=NULL,routing_phase=NULL,error_code='chat_expired' WHERE job_id=$1`,
              [job.id],
            );
          } else {
            // The job FK is deferred, while its same-chat CHECK requires both references cleared together.
            await manager.query(
              `DELETE FROM nodia_ai_job_attempts WHERE job_id=$1`,
              [job.id],
            );
            await manager.query(`DELETE FROM nodia_ai_jobs WHERE id=$1`, [
              job.id,
            ]);
          }
        }
        await manager.query(
          `DELETE FROM nodia_ai_execution_grants WHERE execution_id IN (SELECT id FROM nodia_ai_executions WHERE conversation_id=$1)`,
          [chat.id],
        );
        // A queued approval has no business effect to reconcile and leaves no archive.
        // Keep only genuinely unresolved dispatch identities until native reconciliation.
        await manager.query(
          `DELETE FROM nodia_ai_executions e WHERE e.conversation_id=$1
          AND e.state NOT IN ('running','cancel_requested','unknown')
          AND NOT EXISTS(SELECT 1 FROM nodia_ai_execution_steps s WHERE s.execution_id=e.id AND s.state IN ('running','unknown'))
          AND NOT EXISTS(SELECT 1 FROM nodia_ai_jobs j WHERE j.state='unknown' AND j.recovery_descriptor->>'execution_id'=e.id::text)`,
          [chat.id],
        );
        // Cascades purge messages/parts/runs/events/tools/grants/audit; no content tombstone is retained.
        await manager.query(`DELETE FROM nodia_ai_conversations WHERE id=$1`, [
          chat.id,
        ]);
        if (prepared) {
          const entry = prepared.entries.find(
            (item) => item.conversation_id === chat.id,
          )!;
          purgedResources.push({ kind: 'conversation', ...entry });
        }
      }
      return { purged_chats: chats.length, unresolved_jobs: pending };
    });
    if (purgedResources.length) {
      try {
        await this.deletionJournal.confirmResources(purgedResources);
      } catch {
        // SQL already committed. Never replay the deletion because its external
        // confirmation failed; the journal remains pending for reconciliation.
        new Logger(ExpireNodiaAiConversationsUseCase.name).warn(
          'nodia_ai:deletion_journal_confirmation_pending',
        );
      }
    }
    return result;
  }

  private selectChats(
    manager: EntityManager,
    now: Date,
    ids?: string[],
  ): Promise<{ id: string; retention_epoch: string }[]> {
    return manager.query(
      `SELECT id,retention_epoch FROM nodia_ai_conversations
      WHERE (expires_at <= $1 OR lifecycle='expiring') AND ($3::uuid[] IS NULL OR id=ANY($3::uuid[]))
      ORDER BY expires_at,id LIMIT $2 FOR UPDATE SKIP LOCKED`,
      [now, this.policy.retention.batch_chats, ids ?? null],
    );
  }

  private async captureGenerations(
    manager: EntityManager,
    chats: { id: string }[],
  ) {
    if (!chats.length) return [];
    // Capture generation identities before CASCADE or cleanup removes their metadata.
    const generations: {
      conversation_id: string;
      storage_generation: string;
    }[] = await manager.query(
      `SELECT conversation_id::text,generation::text AS storage_generation
      FROM nodia_ai_attachments WHERE conversation_id=ANY($1::uuid[])
      UNION
      SELECT conversation_id::text,storage_generation::text
      FROM nodia_ai_jobs WHERE conversation_id=ANY($1::uuid[]) AND storage_generation IS NOT NULL
      ORDER BY conversation_id,storage_generation`,
      [chats.map((chat) => chat.id)],
    );
    const byChat = new Map(chats.map((chat) => [chat.id, new Set<string>()]));
    for (const generation of generations)
      byChat
        .get(generation.conversation_id)
        ?.add(generation.storage_generation);
    return chats.map((chat) => ({
      conversation_id: chat.id,
      storage_generations: [...byChat.get(chat.id)!].sort(),
    }));
  }
}
