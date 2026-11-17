import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity.js';
import { User } from '../../user/entities/user.entity.js';

export type BusinessCashMutationOperation =
  | 'category_create'
  | 'category_update'
  | 'movement_create'
  | 'movement_update'
  | 'invoice_create'
  | 'invoice_update'
  | 'invoice_ocr_confirm';

export type BusinessCashMutationStatus =
  'processing' | 'committed' | 'rejected' | 'retryable';

@Entity('business_cash_mutation_requests')
@Check(
  'ck_business_cash_mutation_requests_operation',
  `operation IN ('category_create','category_update','movement_create','movement_update',
                 'invoice_create','invoice_update','invoice_ocr_confirm')`,
)
@Check('ck_business_cash_mutation_requests_version', 'contract_version > 0')
@Check(
  'ck_business_cash_mutation_requests_hash',
  "request_hash ~ '^[a-f0-9]{64}$'",
)
@Check(
  'ck_business_cash_mutation_requests_outcome',
  `(status = 'committed' AND result IS NOT NULL AND jsonb_typeof(result) = 'object' AND error IS NULL)
    OR (status = 'rejected' AND error IS NOT NULL AND jsonb_typeof(error) = 'object' AND result IS NULL)
    OR (status IN ('processing','retryable') AND result IS NULL AND error IS NULL)`,
)
export class BusinessCashMutationRequest {
  @PrimaryColumn('uuid', {
    primaryKeyConstraintName: 'pk_business_cash_mutation_requests',
  })
  business_id: string;
  @PrimaryColumn('bigint', {
    primaryKeyConstraintName: 'pk_business_cash_mutation_requests',
  })
  actor_id: string;
  @PrimaryColumn('uuid', {
    primaryKeyConstraintName: 'pk_business_cash_mutation_requests',
  })
  request_key: string;

  @Column({ type: 'varchar', length: 24 })
  operation: BusinessCashMutationOperation;
  @Column({ type: 'smallint', default: 1 }) contract_version: number;
  @Column({ type: 'varchar', length: 64 }) request_hash: string;
  @Column({ type: 'varchar', length: 16 }) status: BusinessCashMutationStatus;
  @Column('uuid') attempt_id: string;
  @Column('timestamptz') lease_expires_at: Date;
  @Column({ type: 'jsonb', nullable: true }) result: Record<
    string,
    unknown
  > | null;
  @Column({ type: 'jsonb', nullable: true }) error: Record<
    string,
    unknown
  > | null;
  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  created_at: Date;
  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  updated_at: Date;

  @ManyToOne(() => Business, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'business_id',
    foreignKeyConstraintName: 'fk_business_cash_mutation_requests_business',
  })
  business: Relation<Business>;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({
    name: 'actor_id',
    foreignKeyConstraintName: 'fk_business_cash_mutation_requests_actor',
  })
  actor: Relation<User>;
}
