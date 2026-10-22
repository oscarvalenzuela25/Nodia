import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
@Entity('nodia_ai_execution_steps')
export class NodiaAiExecutionStep {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') execution_id!: string;
  @Column('uuid', { nullable: true }) source_step_id!: string | null;
  @Column('integer') position!: number;
  @Column('text') tool_name!: string;
  @Column('char', { length: 64 }) template_hash!: string;
  @Column('char', { length: 64, nullable: true }) bound_command_hash!:
    string | null;
  /** First resolved command; purged with its source proposal, never retained as audit. */
  @Column('jsonb', { nullable: true }) bound_command!: NodiaAiJsonObject | null;
  @Column('uuid') native_request_key!: string;
  @Column('text') state!: string;
  @Column('jsonb') minimal_scope!: NodiaAiJsonObject;
  @Column('jsonb', { nullable: true })
  minimal_receipt!: NodiaAiJsonObject | null;
  @Column('jsonb', { nullable: true })
  recovery_descriptor!: NodiaAiJsonObject | null;
  @Column('bigint') lease_fence!: string;
  @Column('text', { nullable: true }) error_code!: string | null;
  @Column('timestamptz', { nullable: true }) dispatched_at!: Date | null;
  @Column('timestamptz', { nullable: true }) completed_at!: Date | null;
}
