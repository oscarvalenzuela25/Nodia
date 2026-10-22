import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  NODIA_AI_DELETION_JOURNAL,
  type NodiaAiDeletionJournalPort,
} from '../../nodia-ai-recovery/types/deletion-journal.js';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { NodiaAiAttachmentStorage } from '../../nodia-ai-attachment/types/attachment-ports.js';
import { NodiaAiRuntimeService } from '../nodia-ai-runtime.service.js';
import { lockNodiaAiQueue } from '../queue-lock.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../config/runtime-policy.js';

/** Generation-owned, idempotent object deletion. No messages or interpretation survive expiry. */
@Injectable()
export class CleanupNodiaAiAttachmentsUseCase {
  constructor(
    private readonly runtime: NodiaAiRuntimeService,
    private readonly storage: NodiaAiAttachmentStorage,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Inject(NODIA_AI_DELETION_JOURNAL)
    private readonly deletionJournal: NodiaAiDeletionJournalPort,
  ) {}
  async execute(jobId?: string, manual = false) {
    const worker = randomUUID();
    const delivery = await this.runtime.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      // Probe without a row lock: upload and retention always lock chat, attachment, then job.
      const [probe]: {
        id: string;
        conversation_id: string | null;
        storage_generation: string;
      }[] = await manager.query(
        `SELECT id,conversation_id,storage_generation FROM nodia_ai_jobs
         WHERE kind='delete_blob' AND stage_key='attachment_cleanup' AND ($1::uuid IS NULL OR id=$1)
         AND (((state IN ('ready','waiting')) AND (available_at<=clock_timestamp() OR $2))
           OR (state='leased' AND lease_until<=clock_timestamp()) OR ($2 AND state='failed'))
         AND (SELECT count(*) FROM nodia_ai_jobs WHERE kind='delete_blob' AND state='leased' AND lease_until>clock_timestamp())<$3
         ORDER BY available_at,id LIMIT 1`,
        [jobId ?? null, manual, this.policy.queue.maintenance_workers],
      );
      if (!probe) return null;
      if (probe.conversation_id)
        await manager.query(
          'SELECT id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE',
          [probe.conversation_id],
        );
      const [attachment]: {
        id: string;
        state: string;
        write_until_at: Date | null;
      }[] = await manager.query(
        'SELECT id,state,write_until_at FROM nodia_ai_attachments WHERE generation=$1 FOR UPDATE',
        [probe.storage_generation],
      );
      const job = await this.runtime.lockJob(manager, probe.id);
      if (!job || !['ready', 'waiting', 'leased', 'failed'].includes(job.state))
        return null;
      const now = await this.runtime.now(manager);
      if (
        (job.state === 'leased' && job.lease_until! > now) ||
        (!manual && job.available_at > now)
      )
        return null;
      if (attachment?.state === 'ready' && job.conversation_id) {
        // Publishing ready atomically removes its cleanup intent. A stale intent cannot erase live data.
        await manager.query('DELETE FROM nodia_ai_jobs WHERE id=$1', [job.id]);
        return null;
      }
      const descriptor = job.recovery_descriptor;
      if (
        descriptor?.reason !== 'attachment_cleanup' ||
        typeof job.storage_key !== 'string' ||
        typeof job.storage_generation !== 'string' ||
        !/^nodia-ai\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/iu.test(
          job.storage_key,
        ) ||
        !job.storage_key.endsWith(
          `/${String(descriptor?.attachment_id)}/${job.storage_generation}`,
        )
      )
        throw Error('nodia_ai:attachment_cleanup_invalid');
      const writeDeadline = new Date(String(descriptor.write_deadline_until));
      if (!Number.isFinite(writeDeadline.getTime()))
        throw Error('nodia_ai:attachment_cleanup_invalid');
      // A discarded chat can still have an in-flight PUT. Never DELETE before its bounded write window ends.
      if (
        writeDeadline > now ||
        (attachment?.write_until_at && attachment.write_until_at > now)
      )
        return null;
      if (!manual && job.attempt_count >= this.policy.retry.cleanup_attempts) {
        await manager.query(
          "UPDATE nodia_ai_jobs SET state='failed',lease_owner=NULL,lease_until=NULL WHERE id=$1",
          [job.id],
        );
        return null;
      }
      if (attachment)
        await manager.query(
          "UPDATE nodia_ai_attachments SET state='expired',interpretation_text=NULL,interpretation_origin=NULL,interpretation_reviewed=false,interpretation_revision=0 WHERE id=$1",
          [attachment.id],
        );
      const fence = (BigInt(job.fence) + 1n).toString();
      const attempt = job.attempt_count + 1;
      await manager.query(
        "UPDATE nodia_ai_jobs SET state='leased',lease_owner=$2,lease_until=clock_timestamp()+$3*interval '1 second',fence=$4,attempt_count=attempt_count+1,updated_at=clock_timestamp() WHERE id=$1",
        [job.id, worker, this.policy.timing.lease_seconds, fence],
      );
      return {
        id: job.id,
        chatId: job.conversation_id,
        key: job.storage_key,
        generation: job.storage_generation,
        attachmentId: String(descriptor.attachment_id),
        // A chat purge deliberately detaches this job; the owned immutable key
        // retains the original chat identity required by the external witness.
        originalChatId: job.storage_key.split('/')[1],
        deletedAt: now.toISOString(),
        fence,
        attempt,
      };
    });
    if (!delivery) return { processed: 0, settled: 0 };
    let deleted = false;
    try {
      if (this.deletionJournal.enabled)
        await this.deletionJournal.recordResources({
          deleted_at: delivery.deletedAt,
          resources: [{
            kind: 'attachment',
            conversation_id: delivery.originalChatId,
            attachment_id: delivery.attachmentId,
            storage_generations: [delivery.generation],
          }],
        });
      await this.storage.delete(delivery.key);
      deleted = true;
    } catch {
      /* Keep the generation witness until an acknowledged DELETE. */
    }
    const settled = await this.runtime.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      if (delivery.chatId)
        await manager.query(
          'SELECT id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE',
          [delivery.chatId],
        );
      await manager.query(
        'SELECT id FROM nodia_ai_attachments WHERE generation=$1 FOR UPDATE',
        [delivery.generation],
      );
      const job = await this.runtime.lockJob(manager, delivery.id);
      if (!job) return true;
      if (
        job.state !== 'leased' ||
        job.fence !== delivery.fence ||
        job.lease_owner !== worker
      )
        return false;
      if (deleted) {
        // The row was fenced before external deletion; a late uploader can no longer publish it.
        await manager.query(
          "DELETE FROM nodia_ai_attachments WHERE generation=$1 AND state='expired'",
          [delivery.generation],
        );
        await manager.query('DELETE FROM nodia_ai_jobs WHERE id=$1', [job.id]);
        return true;
      }
      const exhausted =
        manual || delivery.attempt >= this.policy.retry.cleanup_attempts;
      const delay =
        this.policy.retry.cleanup_delay_seconds[delivery.attempt - 1] ?? 0;
      await manager.query(
        "UPDATE nodia_ai_jobs SET state=$2,lease_owner=NULL,lease_until=NULL,available_at=clock_timestamp()+$3*interval '1 second',updated_at=clock_timestamp() WHERE id=$1",
        [job.id, exhausted ? 'failed' : 'waiting', delay],
      );
      return false;
    });
    if (deleted && settled && this.deletionJournal.enabled) {
      try {
        await this.deletionJournal.confirmResources([{
          kind: 'attachment',
          conversation_id: delivery.originalChatId,
          attachment_id: delivery.attachmentId,
          storage_generations: [delivery.generation],
        }]);
      } catch {
        // SQL/object deletion is already committed. The external unconfirmed
        // intent blocks backup admission until the offline reconciler verifies
        // absence; never turn a completed deletion into an apparent retry.
      }
    }
    return { processed: 1, settled: settled ? 1 : 0 };
  }
}
