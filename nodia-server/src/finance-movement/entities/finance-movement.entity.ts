import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Check,
  type Relation,
} from 'typeorm';
import { User } from '../../user/entities/user.entity.js';
import { FinanceCategory } from '../../finance-category/entities/finance-category.entity.js';
import { FinanceObligation } from '../../finance-obligation/entities/finance-obligation.entity.js';

export type FinanceMovementType = 'income' | 'expense';
export type FinanceMovementStatus =
  'pending' | 'received' | 'paid' | 'cancelled';

@Entity('finance_movements')
@Index('idx_finance_movements_user_created', { synchronize: false })
@Index('idx_finance_movements_user_category_created', { synchronize: false })
@Index(
  'idx_finance_movements_user_obligation_type_status',
  ['user_id', 'obligation_id', 'type', 'status'],
  { where: '"obligation_id" IS NOT NULL' },
)
@Check('ck_finance_movements_amount', '"amount" > 0')
@Check('ck_finance_movements_type', `"type" IN ('income', 'expense')`)
@Check(
  'ck_finance_movements_status',
  `("type" = 'income' AND "status" IN ('pending', 'received', 'cancelled')) OR ("type" = 'expense' AND "status" IN ('pending', 'paid', 'cancelled'))`,
)
export class FinanceMovement {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) user_id!: string;
  @Column({ type: 'bigint' }) category_id!: string;
  @Column({ type: 'bigint', nullable: true }) obligation_id!: string | null;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ type: 'bigint' }) amount!: string;
  @Column({ type: 'varchar', length: 255 }) type!: FinanceMovementType;
  @Column({ type: 'varchar', length: 255 }) status!: FinanceMovementStatus;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_finance_movements_user',
  })
  user!: Relation<User>;
  @ManyToOne(() => FinanceCategory, { onDelete: 'NO ACTION' })
  @JoinColumn([
    {
      name: 'user_id',
      referencedColumnName: 'user_id',
      foreignKeyConstraintName: 'fk_finance_movements_category',
    },
    {
      name: 'category_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_finance_movements_category',
    },
  ])
  category!: Relation<FinanceCategory>;
  @ManyToOne(() => FinanceObligation, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn([
    {
      name: 'user_id',
      referencedColumnName: 'user_id',
      foreignKeyConstraintName: 'fk_finance_movements_obligation',
    },
    {
      name: 'obligation_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_finance_movements_obligation',
    },
  ])
  obligation!: Relation<FinanceObligation> | null;
}
