import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_audit_events')
export class NodiaAiAuditEvent {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'bigint', nullable: true })
  actor_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  session_public_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  conversation_id!: string | null;

  @Column({ type: 'text' })
  event_key!: string;

  @Column({ type: 'uuid' })
  correlation_id!: string;

  @Column({ type: 'jsonb', nullable: true })
  minimal_details!: NodiaAiJsonObject | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;
}
