import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_jobs')
export class NodiaAiJob {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'text' })
  kind!: string;

  @Column({ type: 'text' })
  dedup_key!: string;

  @Column({ type: 'uuid', nullable: true })
  conversation_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  run_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  execution_id!: string | null;

  @Column({ type: 'text', nullable: true })
  storage_key!: string | null;

  @Column({ type: 'uuid', nullable: true })
  storage_generation!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  recovery_descriptor!: NodiaAiJsonObject | null;

  @Column({ type: 'text' })
  state!: string;

  @Column({ type: 'timestamptz' })
  available_at!: Date;

  @Column({ type: 'uuid', nullable: true })
  lease_owner!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lease_until!: Date | null;

  @Column({ type: 'bigint', default: '0' })
  fence!: string;

  @Column({ type: 'integer', default: 0 })
  attempt_count!: number;

  @Column({ type: 'timestamptz' })
  deadline_at!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updated_at!: Date;

  @Column({ type: 'text' })
  stage_key!: string;

  @Column({ type: 'integer', default: 1 })
  stage_seq!: number;
}
