import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('nodia_ai_proposals')
export class NodiaAiProposal {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') conversation_id!: string;
  @Column('bigint') actor_id!: string;
  @Column('uuid', { nullable: true }) prior_execution_id!: string | null;
  @Column('integer') current_revision!: number;
  @Column('timestamptz') created_at!: Date;
}
