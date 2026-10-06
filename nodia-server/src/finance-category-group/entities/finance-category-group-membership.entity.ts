import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../user/entities/user.entity.js';
import { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';
import { FinanceCategoryGroup } from './finance-category-group.entity.js';

@Entity('finance_category_group_memberships')
@Unique('uq_finance_memberships_user_group_category', [
  'user_id',
  'category_group_id',
  'category_id',
])
@Index('idx_finance_memberships_user_category_group', [
  'user_id',
  'category_id',
  'category_group_id',
])
export class FinanceCategoryGroupMembership {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) user_id!: string;
  @Column({ type: 'bigint' }) category_group_id!: string;
  @Column({ type: 'bigint' }) category_id!: string;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @ManyToOne(() => User, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_finance_memberships_user',
  })
  user!: Relation<User>;
  @ManyToOne(() => FinanceCategoryGroup, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    {
      name: 'user_id',
      referencedColumnName: 'user_id',
      foreignKeyConstraintName: 'fk_finance_memberships_group',
    },
    {
      name: 'category_group_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_finance_memberships_group',
    },
  ])
  category_group!: Relation<FinanceCategoryGroup>;
  @ManyToOne(() => FinanceCategory, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    {
      name: 'user_id',
      referencedColumnName: 'user_id',
      foreignKeyConstraintName: 'fk_finance_memberships_category',
    },
    {
      name: 'category_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_finance_memberships_category',
    },
  ])
  category!: Relation<FinanceCategory>;
}
