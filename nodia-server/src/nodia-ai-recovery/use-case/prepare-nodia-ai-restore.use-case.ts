import { Injectable, Optional } from '@nestjs/common';
import { hasGenerationBridge } from '../../ai-generation/chat-generation-ownership.js';
import { DataSource } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import type { NodiaAiRuntimePolicy } from '../../nodia-ai-runtime/config/runtime-policy.js';
import { ExpireNodiaAiConversationsUseCase } from '../../nodia-ai-conversation/use-case/expire-nodia-ai-conversations.use-case.js';
import { ValidateNodiaAiRestoreUseCase, type NodiaAiRestoreInput } from './validate-nodia-ai-restore.use-case.js';
import { NodiaAiAttachmentService } from '../../nodia-ai-attachment/nodia-ai-attachment.service.js';
import { NodiaAiAttachment } from '../../nodia-ai-attachment/entities/nodia-ai-attachment.entity.js';

/** Operator-only composition, deliberately absent from API/worker DI. No network or native effect. */
@Injectable()
export class PrepareNodiaAiRestoreUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly expire: ExpireNodiaAiConversationsUseCase,
    private readonly validate: ValidateNodiaAiRestoreUseCase,
    @Optional() private readonly attachments?: NodiaAiAttachmentService,
  ) {}

  async execute(input: NodiaAiRestoreInput) {
    const prepared = await this.source.transaction(async manager => {
      await lockAuthority(manager, true, this.policy.timing.read_query_seconds * 1000);
      await lockNodiaAiQueue(manager);
      if(await hasGenerationBridge(manager)){
        const rows:{populated:boolean}[]=await manager.query('SELECT EXISTS(SELECT 1 FROM teacher_sessions) AS populated');
        if(rows[0]?.populated)throw Error('nodia_ai:teacher_restore_requires_owner_reconciliation');
      }
      const [clock]: { now: Date }[] = await manager.query('SELECT clock_timestamp() AS now');
      const manifest = this.validate.execute(input, new Date(clock.now), this.policy);
      // Restored ready/claimed records can have been sent after backup capture. None proves never-sent.
      await manager.query("UPDATE nodia_ai_execution_grants SET revoked_at=$1 WHERE revoked_at IS NULL", [clock.now]);
      await manager.query('DELETE FROM nodia_ai_confirmation_challenges');
      await manager.query("UPDATE nodia_ai_proposal_revisions SET state='expired' WHERE state IN ('draft','ready')");
      await manager.query("UPDATE nodia_ai_drafts SET state='invalidated' WHERE state IN ('incomplete','ready','claimed')");
      // The marker survives restart/purge and blocks normal SQL/native/login reconciliation.
      await manager.query("UPDATE nodia_ai_jobs SET recovery_descriptor=COALESCE(recovery_descriptor,'{}'::jsonb)||'{\"restore_quarantined\":true}'::jsonb WHERE kind IN ('turn','execution','reconcile')");
      await manager.query("UPDATE nodia_ai_jobs SET state='unknown',fence=fence+1,lease_owner=NULL,lease_until=NULL,updated_at=$1 WHERE (kind IN ('turn','execution') AND state IN ('ready','waiting','leased')) OR (kind='execution' AND state='failed')", [clock.now]);
      await manager.query("UPDATE nodia_ai_job_attempts SET phase='unknown',ended_at=COALESCE(ended_at,$1),error_code='nodia_ai:outcome_unknown' WHERE job_id IN (SELECT id FROM nodia_ai_jobs WHERE kind IN ('turn','execution') AND state='unknown') AND phase NOT IN ('completed','abandoned')", [clock.now]);
      await manager.query("UPDATE nodia_ai_runs SET state='unknown',error_code='nodia_ai:outcome_unknown',completed_at=NULL WHERE state IN ('queued','running','cancel_requested')");
      // Preserve terminal historical headers: promoting multiple failures in one chat would violate its active-execution invariant.
      // Failed steps below become uncertain and the job marker prevents reusing an old rollback as resume authority.
      await manager.query("UPDATE nodia_ai_executions SET state='unknown',revision=revision+1 WHERE state IN ('queued','running','cancel_requested','waiting_for_user')");
      await manager.query("UPDATE nodia_ai_execution_steps SET state='unknown',error_code='nodia_ai:outcome_unknown' WHERE state IN ('pending','ready','running','waiting_for_user','blocked','failed')");
      // Keep the original native identity. A restored free slot is not evidence of current remote quiet.
      await manager.query("UPDATE nodia_ai_runtime_slots SET state='unknown',fence=fence+1,updated_at=$1", [clock.now]);
      const conversationIds = manifest.schema_version === 1
        ? manifest.entries.map(entry => entry.conversation_id)
        : manifest.entries.flatMap(entry => entry.kind === 'conversation' ? [entry.conversation_id] : []);
      const conversationTombstones = new Set(conversationIds);
      for (let offset = 0; offset < conversationIds.length; offset += this.policy.retention.batch_chats) {
        const ids = conversationIds.slice(offset, offset + this.policy.retention.batch_chats);
        await manager.query("UPDATE nodia_ai_conversations SET lifecycle='expiring' WHERE id=ANY($1::uuid[])", [ids]);
      }
      let restoredAttachments = 0, restoredPreferences = 0;
      if (manifest.schema_version === 2) {
        for (const entry of manifest.entries) {
          if (entry.kind === 'preference') {
            // An accepted preference has its own lifecycle, independent of chat
            // expiry. A later accepted replacement has a different immutable ID.
            const deleted: { id: string }[] = await manager.query('DELETE FROM nodia_ai_preferences WHERE id=$1 RETURNING id', [entry.preference_id]);
            restoredPreferences += deleted.length;
          } else if (entry.kind === 'attachment') {
            // Cleanup can record both the whole-chat deletion and its bound
            // file generations. The ordinary chat purge owns those references;
            // they are not contradictory individual draft-discard requests.
            if (conversationTombstones.has(entry.conversation_id)) continue;
            const [parent]: { lifecycle: string; expires_at: Date }[] = await manager.query(
              'SELECT lifecycle,expires_at FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE', [entry.conversation_id]);
            if (!parent || parent.lifecycle === 'expiring' || new Date(parent.expires_at).getTime() <= new Date(clock.now).getTime()) continue;
            const row = await manager.getRepository(NodiaAiAttachment).findOne({
              where: { id: entry.attachment_id, conversation_id: entry.conversation_id, generation: entry.storage_generations[0] },
              lock: { mode: 'pessimistic_write' },
            });
            if (!row) continue;
            // Individual discard only permits unbound drafts. A conflicting
            // bound reference is not permission to delete a message or its chat.
            const [bound]: { exists: boolean }[] = await manager.query(
              'SELECT EXISTS(SELECT 1 FROM nodia_ai_message_parts WHERE attachment_id=$1) AS exists', [row.id]);
            if (bound?.exists) throw Error('nodia_ai:restore_resource_conflict');
            if (!this.attachments) throw Error('nodia_ai:restore_attachment_cleanup_unavailable');
            row.state = 'expired';
            row.interpretation_text = null;
            row.interpretation_origin = null;
            row.interpretation_reviewed = false;
            row.interpretation_revision = 0;
            await this.attachments.queueCleanup(manager, row, new Date(clock.now));
            restoredAttachments++;
          }
        }
      }
      const [pending]: { count: string }[] = await manager.query("SELECT count(*)::text AS count FROM nodia_ai_conversations WHERE expires_at<=$1 OR lifecycle='expiring'", [clock.now]);
      return {
        marked_chats: Number(pending.count),
        manifest_entries: manifest.entries.length,
        external_generations: new Set(manifest.entries.flatMap(entry => 'storage_generations' in entry ? entry.storage_generations : [])).size,
        attachment_tombstones_applied: restoredAttachments,
        preference_tombstones_applied: restoredPreferences,
      };
    });
    // Bounded transactions use the exact production retention path, including independent cleanup witnesses.
    let purged = 0;
    while (purged < prepared.marked_chats) {
      const result = await this.expire.execute();
      if (!result.purged_chats) throw Error('nodia_ai:restore_purge_incomplete');
      purged += result.purged_chats;
    }
    const [remaining]: { count: string }[] = await this.source.query("SELECT count(*)::text AS count FROM nodia_ai_conversations WHERE expires_at<=clock_timestamp() OR lifecycle='expiring'");
    if (remaining.count !== '0') throw Error('nodia_ai:restore_purge_incomplete');
    return {
      prepared: true as const,
      purged_chats: purged,
      deletion_entries: prepared.manifest_entries,
      external_generations_requiring_inventory: prepared.external_generations,
      attachment_tombstones_applied: prepared.attachment_tombstones_applied,
      preference_tombstones_applied: prepared.preference_tombstones_applied,
      dispatches: 0 as const,
      release_authorized: false as const,
      // Preparing a copy never certifies current-domain/native reconciliation or opens normal mode.
      next_action: 'reconcile_current_domain_and_native_runtimes' as const,
    };
  }
}
