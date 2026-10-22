import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('nodia_ai_confirmation_challenges')
export class NodiaAiConfirmationChallenge {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') proposal_id!: string;
  @Column('integer') proposal_revision!: number;
  @Column('bigint') actor_id!: string;
  @Column('uuid', { nullable: true }) session_public_id!: string | null;
  @Column('char', { length: 64 }) expected_hash!: string;
  @Column('char', { length: 64 }) token_hash!: string;
  @Column('timestamptz') expires_at!: Date;
  @Column('timestamptz', { nullable: true }) consumed_at!: Date | null;
  @Column('timestamptz') created_at!: Date;
}
