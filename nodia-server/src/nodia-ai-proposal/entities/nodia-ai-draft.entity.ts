import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
@Entity('nodia_ai_drafts')
export class NodiaAiDraft {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') conversation_id!: string;
  @Column('bigint') actor_id!: string;
  @Column('uuid', { nullable: true }) tool_call_id!: string | null;
  @Column('text') tool_name!: string;
  @Column('text') catalog_version!: string;
  @Column('integer') revision!: number;
  @Column('jsonb') scope!: NodiaAiJsonObject;
  @Column('jsonb') partial_command!: NodiaAiJsonObject;
  @Column('jsonb') clarifications!: NodiaAiJsonObject;
  @Column('text') state!: string;
  @Column('uuid', { nullable: true }) claimed_proposal_id!: string | null;
  @Column('timestamptz') created_at!: Date;
  @Column('timestamptz') updated_at!: Date;
}
