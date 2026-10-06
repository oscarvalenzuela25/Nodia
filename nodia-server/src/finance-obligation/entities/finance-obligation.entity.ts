import {
  Column,
  CreateDateColumn,
  Entity,
  Unique,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Check,
  type Relation,
} from 'typeorm';
import { User } from '../../user/entities/user.entity.js';

export type FinanceObligationType = 'loan' | 'debt';

@Entity('finance_obligations')
@Unique('uq_finance_obligations_user_key', ['user_id', 'key'])
@Unique('uq_finance_obligations_user_id', ['user_id', 'id'])
@Check('ck_finance_obligations_amount', '"amount" > 0')
@Check('ck_finance_obligations_type', `"type" IN ('loan', 'debt')`)
export class FinanceObligation {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) user_id!: string;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ type: 'varchar', length: 255 }) key!: string;
  @Column({ type: 'varchar', length: 255 }) type!: FinanceObligationType;
  @Column({ type: 'bigint' }) amount!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_finance_obligations_user',
  })
  user!: Relation<User>;
}
