import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity.js';
import { User } from '../../user/entities/user.entity.js';

@Entity('business_cash_categories')
@Unique('uq_business_cash_categories_business_normalized_name', [
  'business_id',
  'normalized_name',
])
@Unique('uq_business_cash_categories_id_business', ['id', 'business_id'])
@Index('idx_business_cash_categories_activity_order', [
  'business_id',
  'is_active',
  'normalized_name',
  'id',
])
@Check('ck_business_cash_categories_name', 'char_length(btrim(name)) > 0')
@Check(
  'ck_business_cash_categories_normalized_name',
  'octet_length(normalized_name) BETWEEN 1 AND 1024',
)
@Check(
  'ck_business_cash_categories_description',
  'char_length(btrim(description)) > 0',
)
@Check('ck_business_cash_categories_version', 'version > 0')
export class BusinessCashCategory {
  @PrimaryGeneratedColumn({
    type: 'bigint',
    primaryKeyConstraintName: 'pk_business_cash_categories',
  })
  id: string;

  @Column('uuid') business_id: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'text', collation: 'C' }) normalized_name: string;
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
    foreignKeyConstraintName: 'fk_business_cash_categories_business',
  })
  business: Relation<Business>;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'fk_business_cash_categories_created_by',
  })
  createdBy: Relation<User>;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({
    name: 'updated_by',
    foreignKeyConstraintName: 'fk_business_cash_categories_updated_by',
  })
  updatedBy: Relation<User>;
}
