import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  Unique,
} from 'typeorm';

@Entity('nodia_cv_profile_create_receipts')
@Unique('uq_nodia_cv_profile_receipts_profile', ['profile_id'])
export class NodiaCvProfileCreateReceiptEntity {
  @PrimaryColumn('bigint') owner_user_id!: string;
  @PrimaryColumn('uuid') request_key!: string;
  // The receipt retains the ID after the profile is deleted.
  @Column('uuid') profile_id!: string;
  @Column('varchar', { length: 64, nullable: true })
  request_hash!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
}
