import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_events')
export class NodiaAiEvent {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  conversation_id!: string;

  @Column({ type: 'bigint' })
  seq!: string;

  @Column({ type: 'text' })
  event_key!: string;

  @Column({ type: 'uuid', nullable: true })
  run_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  execution_id!: string | null;

  @Column({ type: 'jsonb' })
  public_payload!: NodiaAiJsonObject;

  @Column({ type: 'jsonb' })
  scope_manifest!: NodiaAiJsonObject;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;
}
