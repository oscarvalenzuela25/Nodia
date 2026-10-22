import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('nodia_ai_proposal_revisions')
export class NodiaAiProposalRevision {
  @PrimaryColumn('uuid') proposal_id!: string;
  @PrimaryColumn('integer') revision!: number;
  @Column('text') state!: string;
  @Column('char', { length: 64 }) hash!: string;
  @Column('text') catalog_version!: string;
  @Column('text') canonicalization_version!: string;
  @Column('timestamptz') created_at!: Date;
  @Column('timestamptz') expires_at!: Date;
}
