import { Column, Entity, PrimaryColumn } from 'typeorm';
import type {
  NodiaAiRoutingTarget,
  NodiaAiSelection,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_conversations')
export class NodiaAiConversation {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'bigint' })
  owner_id!: string;

  @Column({ type: 'uuid' })
  client_request_id!: string;

  @Column({ type: 'text', nullable: true })
  title!: string | null;

  @Column({ type: 'boolean', default: false })
  is_pinned!: boolean;

  @Column({ type: 'boolean', default: false })
  is_archived!: boolean;

  @Column({ type: 'integer', default: 1 })
  revision!: number;

  @Column({ type: 'bigint', default: '1' })
  retention_epoch!: string;

  @Column({ type: 'bigint', nullable: true })
  selected_connection_id!: string | null;

  @Column({ type: 'text', nullable: true })
  selected_mode!: NodiaAiSelection['mode'] | null;

  @Column({ type: 'text', nullable: true })
  selected_model_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  active_job_id!: string | null;

  @Column({ type: 'bigint', default: '0' })
  next_message_seq!: string;

  @Column({ type: 'bigint', default: '0' })
  next_event_seq!: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_owner_message_at!: Date | null;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ type: 'text', default: 'active' })
  lifecycle!: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updated_at!: Date;

  @Column({ type: 'char', length: 64 })
  creation_request_hash!: string;

  @Column({ type: 'text', nullable: true })
  selected_effort_id!: string | null;

  @Column({ type: 'integer', default: 1 })
  routing_revision!: number;

  @Column({ type: 'boolean', default: false })
  routing_enabled!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  routing_target_selection!: NodiaAiRoutingTarget | null;
}
