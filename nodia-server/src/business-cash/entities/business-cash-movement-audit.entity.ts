import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../user/entities/user.entity.js';
import { BusinessCashMovement } from './business-cash-movement.entity.js';

@Entity('business_cash_movement_audit')
@Check(
  'ck_business_cash_movement_audit_operation',
  `(operation = 'movement_create' AND version = 1 AND "before" IS NULL)
    OR (operation = 'movement_update' AND version > 1
        AND "before" IS NOT NULL AND jsonb_typeof("before") = 'object')`,
)
@Check(
  'ck_business_cash_movement_audit_after',
  `jsonb_typeof("after") = 'object'`,
)
export class BusinessCashMovementAudit {
  @PrimaryColumn('uuid', {
    primaryKeyConstraintName: 'pk_business_cash_movement_audit',
  })
  movement_id: string;

  @PrimaryColumn('integer', {
    primaryKeyConstraintName: 'pk_business_cash_movement_audit',
  })
  version: number;

  @Column('uuid') business_id: string;
  @Column('bigint') actor_id: string;
  @Column({ type: 'varchar', length: 24 }) operation:
    'movement_create' | 'movement_update';
  @Column({ type: 'jsonb', nullable: true }) before: Record<
    string,
    unknown
  > | null;
  @Column('jsonb') after: Record<string, unknown>;
  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  created_at: Date;

  @ManyToOne(() => BusinessCashMovement, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'movement_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_business_cash_movement_audit_movement',
    },
    {
      name: 'business_id',
      referencedColumnName: 'business_id',
      foreignKeyConstraintName: 'fk_business_cash_movement_audit_movement',
    },
  ])
  movement: Relation<BusinessCashMovement>;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({
    name: 'actor_id',
    foreignKeyConstraintName: 'fk_business_cash_movement_audit_actor',
  })
  actor: Relation<User>;
}
