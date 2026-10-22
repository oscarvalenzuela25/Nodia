import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
@Entity('nodia_ai_executions')
export class NodiaAiExecution {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid', { nullable: true }) conversation_id!: string | null;
  @Column('uuid', { nullable: true }) proposal_id!: string | null;
  @Column('uuid') origin_conversation_id!: string;
  @Column('uuid') origin_proposal_id!: string;
  @Column('integer') origin_proposal_revision!: number;
  @Column('char', { length: 64 }) proposal_hash!: string;
  @Column('bigint') actor_id!: string;
  @Column('bigint') chat_owner_id!: string;
  @Column('uuid') client_request_id!: string;
  @Column('text') catalog_version!: string;
  @Column('integer') revision!: number;
  @Column('text') state!: string;
  @Column('jsonb') minimal_scope!: NodiaAiJsonObject;
  @Column('uuid', { nullable: true }) prior_execution_id!: string | null;
  @Column('timestamptz') created_at!: Date;
  @Column('timestamptz', { nullable: true }) completed_at!: Date | null;
  @Column('bigint') retention_epoch!: string;
}
