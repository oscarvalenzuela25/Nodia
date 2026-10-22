import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_messages')
export class NodiaAiMessage {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  conversation_id!: string;

  @Column({ type: 'bigint' })
  seq!: string;

  @Column({ type: 'text' })
  role!: string;

  @Column({ type: 'bigint', nullable: true })
  author_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  client_message_id!: string | null;

  @Column({ type: 'text' })
  status!: string;

  @Column({ type: 'jsonb' })
  source_scope_manifest!: NodiaAiJsonObject;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sealed_at!: Date | null;

  @Column({ type: 'char', length: 64, nullable: true })
  input_hash!: string | null;
}
