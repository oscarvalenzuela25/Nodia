import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_job_attempts')
export class NodiaAiJobAttempt {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  job_id!: string;

  @Column({ type: 'integer' })
  attempt_no!: number;

  @Column({ type: 'bigint' })
  fence!: string;

  @Column({ type: 'uuid' })
  worker_id!: string;

  @Column({ type: 'text' })
  phase!: string;

  @Column({ type: 'text', nullable: true })
  error_code!: string | null;

  @Column({ type: 'text', nullable: true })
  external_operation_ref!: string | null;

  @Column({ type: 'timestamptz' })
  started_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ended_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  runtime_resource_key!: string | null;

  @Column({ type: 'bigint', nullable: true })
  runtime_fence!: string | null;

  @Column({ type: 'text' })
  stage_key!: string;

  @Column({ type: 'integer' })
  stage_seq!: number;

  @Column({ type: 'jsonb', nullable: true })
  selection_snapshot!: NodiaAiSelection | null;

  @Column({ type: 'text', nullable: true })
  routing_phase!: string | null;
}
