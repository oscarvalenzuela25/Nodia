import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity.js';
import { User } from '../../user/entities/user.entity.js';
import type { CashMovementType } from '../types/cash.types.js';
import { BusinessCashCategory } from './business-cash-category.entity.js';

@Entity('business_cash_movements')
@Unique('uq_business_cash_movements_id_business', ['id', 'business_id'])
@Index('idx_business_cash_movements_activity_date', [
  'business_id',
  'is_active',
  'occurred_on',
  'id',
])
@Index('idx_business_cash_movements_category_date', [
  'business_id',
  'category_id',
  'occurred_on',
  'id',
])
@Check('ck_business_cash_movements_type', "type IN ('income', 'expense')")
@Check(
  'ck_business_cash_movements_amount',
  'amount BETWEEN 1 AND 9999999999999',
)
@Check(
  'ck_business_cash_movements_occurred_on',
  "occurred_on BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'",
)
@Check('ck_business_cash_movements_description', "description ~ '[^[:space:]]'")
@Check('ck_business_cash_movements_version', 'version > 0')
export class BusinessCashMovement {
  @PrimaryColumn('uuid', {
    primaryKeyConstraintName: 'pk_business_cash_movements',
  })
  id: string;

  @Column('uuid') business_id: string;
  @Column('bigint') category_id: string;
  @Column({ type: 'varchar', length: 7 }) type: CashMovementType;
  @Column('bigint') amount: string;
  @Column('date') occurred_on: string;
  @Column({ type: 'varchar', length: 500 }) description: string;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'integer', default: 1 }) version: number;
  @Column('bigint') created_by: string;
  @Column('bigint') updated_by: string;
  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  created_at: Date;
  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  updated_at: Date;

  @ManyToOne(() => Business, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'business_id',
    foreignKeyConstraintName: 'fk_business_cash_movements_business',
  })
  business: Relation<Business>;

  @ManyToOne(() => BusinessCashCategory, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'category_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_business_cash_movements_category',
    },
    {
      name: 'business_id',
      referencedColumnName: 'business_id',
      foreignKeyConstraintName: 'fk_business_cash_movements_category',
    },
  ])
  category: Relation<BusinessCashCategory>;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'fk_business_cash_movements_created_by',
  })
  createdBy: Relation<User>;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({
    name: 'updated_by',
    foreignKeyConstraintName: 'fk_business_cash_movements_updated_by',
  })
  updatedBy: Relation<User>;
}
