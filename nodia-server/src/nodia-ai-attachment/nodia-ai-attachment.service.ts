import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { NodiaAiAttachment } from './entities/nodia-ai-attachment.entity.js';
import { randomUUID } from 'node:crypto';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../nodia-ai-runtime/config/runtime-policy.js';

@Injectable()
export class NodiaAiAttachmentService {
  constructor(
    private readonly source: DataSource,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  transaction<T>(work: (manager: EntityManager) => Promise<T>) {
    return this.source.transaction(work);
  }
  /** Serializes global reservations, not storage I/O. Authority lock precedes this lock. */
  async lockReservations(manager: EntityManager) {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('nodia_ai_attachment_reservations',0))",
    );
  }
  async find(manager: EntityManager, id: string, lock = true) {
    const row = await manager.getRepository(NodiaAiAttachment).findOne({
      where: { id },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (!row) throw new NotFoundException('nodia_ai:attachment_not_found');
    return row;
  }
  save(manager: EntityManager, row: NodiaAiAttachment) {
    return manager.getRepository(NodiaAiAttachment).save(row);
  }
  /**
   * Caller holds reservation lock. Bytes include pending original objects and stored text derivatives.
   * An armed, unfinished compaction reserves at most twice the existing assistant JSON budget
   * (conservative jsonb formatting overhead) plus its admitted scope. Unknown runs retain it;
   * atomically storing the snapshot and its manifest reference replaces this reservation with real bytes.
   */
  async usage(
    manager: EntityManager,
    chatId: string,
    ownerId: string,
    now: Date,
    excludeRunId?: string,
  ) {
    const [usage]: {
      chat_bytes: string;
      owner_bytes: string;
      chat_count: string;
      owner_uploads: string;
      global_uploads: string;
    }[] = await manager.query(
      `
      SELECT (COALESCE(sum(a.reserved_bytes+COALESCE(octet_length(a.interpretation_text),0)) FILTER(WHERE a.conversation_id=$1),0)+
        COALESCE((SELECT sum(octet_length(p.text)) FROM nodia_ai_message_parts p WHERE p.conversation_id=$1),0)+
        COALESCE((SELECT sum(octet_length(s.summary::text)+octet_length(s.scope_manifest::text)) FROM nodia_ai_context_snapshots s WHERE s.conversation_id=$1),0)+
        COALESCE((SELECT sum(2*$4::bigint+octet_length(jsonb_build_object('schema_version',1,'module_routes',r.context_manifest->'module_routes')::text))
          FROM nodia_ai_runs r WHERE r.conversation_id=$1 AND ($5::uuid IS NULL OR r.id<>$5)
          AND r.compactions_used>0 AND r.context_manifest->'compaction'->>'snapshot_id' IS NULL
          AND r.state IN ('queued','running','cancel_requested','unknown')),0)+
        (SELECT count(*)*$4::bigint FROM nodia_ai_runs r WHERE r.conversation_id=$1 AND ($5::uuid IS NULL OR r.id<>$5) AND r.assistant_message_id IS NULL AND r.state IN ('queued','running','cancel_requested','unknown')))::text chat_bytes,
        (COALESCE(sum(a.reserved_bytes+COALESCE(octet_length(a.interpretation_text),0)) FILTER(WHERE c.owner_id=$2),0)+
          COALESCE((SELECT sum((j.recovery_descriptor->>'reserved_bytes')::bigint) FROM nodia_ai_jobs j
            WHERE j.kind='delete_blob' AND j.state<>'done' AND j.recovery_descriptor->>'owner_id'=$2::text
            AND j.recovery_descriptor->>'reason'='attachment_cleanup'
            AND NOT EXISTS(SELECT 1 FROM nodia_ai_attachments z WHERE z.generation=j.storage_generation)),0)+
          COALESCE((SELECT sum(octet_length(p.text)) FROM nodia_ai_message_parts p JOIN nodia_ai_conversations t ON t.id=p.conversation_id WHERE t.owner_id=$2),0)+
          COALESCE((SELECT sum(octet_length(s.summary::text)+octet_length(s.scope_manifest::text)) FROM nodia_ai_context_snapshots s JOIN nodia_ai_conversations t ON t.id=s.conversation_id WHERE t.owner_id=$2),0)+
          COALESCE((SELECT sum(2*$4::bigint+octet_length(jsonb_build_object('schema_version',1,'module_routes',r.context_manifest->'module_routes')::text))
            FROM nodia_ai_runs r JOIN nodia_ai_conversations t ON t.id=r.conversation_id
            WHERE t.owner_id=$2 AND ($5::uuid IS NULL OR r.id<>$5)
            AND r.compactions_used>0 AND r.context_manifest->'compaction'->>'snapshot_id' IS NULL
            AND r.state IN ('queued','running','cancel_requested','unknown')),0)+
          (SELECT count(*)*$4::bigint FROM nodia_ai_runs r JOIN nodia_ai_conversations t ON t.id=r.conversation_id WHERE t.owner_id=$2 AND ($5::uuid IS NULL OR r.id<>$5) AND r.assistant_message_id IS NULL AND r.state IN ('queued','running','cancel_requested','unknown')))::text owner_bytes,
        count(*) FILTER(WHERE a.conversation_id=$1)::text chat_count,
        (count(*) FILTER(WHERE c.owner_id=$2 AND ((a.state='uploading' AND a.expires_at>$3) OR a.write_until_at>$3))+
          (SELECT count(*) FROM nodia_ai_jobs j WHERE j.kind='delete_blob' AND j.state<>'done'
            AND j.recovery_descriptor->>'owner_id'=$2::text AND j.recovery_descriptor->>'reason'='attachment_cleanup'
            AND (j.recovery_descriptor->>'write_deadline_until')::timestamptz>$3
            AND NOT EXISTS(SELECT 1 FROM nodia_ai_attachments z WHERE z.generation=j.storage_generation)))::text owner_uploads,
        (count(*) FILTER(WHERE (a.state='uploading' AND a.expires_at>$3) OR a.write_until_at>$3)+
          (SELECT count(*) FROM nodia_ai_jobs j WHERE j.kind='delete_blob' AND j.state<>'done'
            AND j.recovery_descriptor->>'reason'='attachment_cleanup'
            AND (j.recovery_descriptor->>'write_deadline_until')::timestamptz>$3
            AND NOT EXISTS(SELECT 1 FROM nodia_ai_attachments z WHERE z.generation=j.storage_generation)))::text global_uploads
      FROM nodia_ai_attachments a JOIN nodia_ai_conversations c ON c.id=a.conversation_id`,
      [
        chatId,
        ownerId,
        now,
        this.policy.results.assistant_text_utf8_bytes,
        excludeRunId ?? null,
      ],
    );
    return usage;
  }
  async bound(manager: EntityManager, id: string): Promise<boolean> {
    const [row]: { bound: boolean }[] = await manager.query(
      'SELECT EXISTS(SELECT 1 FROM nodia_ai_message_parts WHERE attachment_id=$1) AS bound',
      [id],
    );
    return row.bound;
  }
  async queueCleanup(
    manager: EntityManager,
    row: NodiaAiAttachment,
    now: Date,
  ) {
    const [chat]: { owner_id: string }[] = await manager.query(
      'SELECT owner_id::text FROM nodia_ai_conversations WHERE id=$1',
      [row.conversation_id],
    );
    const available = new Date(
      Math.max(now.getTime(), row.write_until_at?.getTime() ?? 0),
    );
    await manager.query(
      `INSERT INTO nodia_ai_jobs
      (id,kind,dedup_key,conversation_id,storage_key,storage_generation,recovery_descriptor,state,available_at,deadline_at,stage_key)
      VALUES($1,'delete_blob',$2,$3,$4,$5,$6,'ready',$7,$8,'attachment_cleanup')
      ON CONFLICT(dedup_key) DO UPDATE SET state='ready',available_at=GREATEST(nodia_ai_jobs.available_at,EXCLUDED.available_at),
        recovery_descriptor=EXCLUDED.recovery_descriptor,updated_at=$9
      WHERE nodia_ai_jobs.state<>'leased'`,
      [
        randomUUID(),
        `attachment:${row.id}:${row.generation}`,
        row.conversation_id,
        row.storage_key,
        row.generation,
        {
          schema_version: 1,
          reason: 'attachment_cleanup',
          attachment_id: row.id,
          owner_id: chat.owner_id,
          reserved_bytes: row.reserved_bytes,
          write_deadline_until: available.toISOString(),
        },
        available,
        new Date(
          available.getTime() +
            this.policy.retention.physical_cleanup_target_seconds * 1000,
        ),
        now,
      ],
    );
    await this.save(manager, row);
  }
  /** Must run in the expiry transaction before chat CASCADE removes its private attachment metadata. */
  async scheduleChatCleanup(
    manager: EntityManager,
    conversationId: string,
    now: Date,
  ) {
    const rows = await manager.getRepository(NodiaAiAttachment).find({
      where: { conversation_id: conversationId },
      lock: { mode: 'pessimistic_write' },
    });
    for (const row of rows) await this.queueCleanup(manager, row, now);
  }
}
