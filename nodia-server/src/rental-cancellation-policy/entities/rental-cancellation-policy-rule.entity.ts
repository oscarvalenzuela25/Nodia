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
import { RentalCancellationPolicy } from '../../rental-cancellation-policy/entities/rental-cancellation-policy.entity.js';
import { User } from '../../user/entities/user.entity.js';

@Entity('rental_cancellation_rules')
@Index('uq_rental_policy_threshold', ['policy_id', 'min_days_before'], {
  unique: true,
})
@Check('ck_rental_cancellation_rules_min_days_before', 'min_days_before >= 0')
@Check(
  'ck_rental_cancellation_rules_refund_percent',
  'refund_percent BETWEEN 0 AND 100',
)
export class RentalCancellationRule {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) policy_id!: string;
  @Column({ type: 'integer' }) min_days_before!: number;
  @Column({ type: 'numeric', precision: 5, scale: 2 }) refund_percent!: string;
  @Column({ type: 'bigint' }) created_by!: string;
  @Column({ type: 'bigint' }) updated_by!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @ManyToOne(() => RentalCancellationPolicy, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'policy_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_cancellation_rules_policy_id',
    },
  ])
  relation_policy_id!: Relation<RentalCancellationPolicy>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'created_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_cancellation_rules_created_by',
    },
  ])
  relation_created_by!: Relation<User>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'updated_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_cancellation_rules_updated_by',
    },
  ])
  relation_updated_by!: Relation<User>;
}
