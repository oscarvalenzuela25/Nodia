import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
@Entity('nodia_ai_proposal_steps')
export class NodiaAiProposalStep {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') proposal_id!: string;
  @Column('integer') proposal_revision!: number;
  @Column('integer') position!: number;
  @Column('text') tool_name!: string;
  @Column('char', { length: 64 }) contract_hash!: string;
  @Column('text') kind!: string;
  @Column('text') effect_key!: string;
  @Column('jsonb') scope!: NodiaAiJsonObject;
  @Column('jsonb') command_template!: NodiaAiJsonObject;
  @Column('jsonb') public_step!: NodiaAiJsonObject;
  @Column('jsonb') output_bindings!: NodiaAiJsonObject[];
  @Column('jsonb') preconditions!: NodiaAiJsonObject;
}
