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
import { RentalCancellationPolicy } from '../../rental-cancellation-policy/entities/rental-cancellation-policy.entity.js';

@Entity('rental_properties')
@Index('idx_rental_properties_owner', ['owner_id'], { unique: false })
@Check('ck_rental_properties_max_guests', 'max_guests > 0')
@Check('ck_rental_properties_default_nightly_rate', 'default_nightly_rate > 0')
@Check(
  'ck_rental_properties_default_deposit_percent',
  'default_deposit_percent BETWEEN 0 AND 100',
)
@Check(
  'ck_rental_properties_minimum_turnover_minutes',
  'minimum_turnover_minutes >= 0',
)
export class RentalProperty {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) owner_id!: string;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) location!:
    string | null;
  @Column({ type: 'varchar', length: 64 }) timezone!: string;
  @Column({ type: 'integer' }) max_guests!: number;
  @Column({ type: 'time' }) check_in_time!: string;
  @Column({ type: 'time' }) check_out_time!: string;
  @Column({ type: 'bigint', nullable: true }) default_nightly_rate!:
    string | null;
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  default_deposit_percent!: string | null;
  @Column({ type: 'integer', default: 0 }) minimum_turnover_minutes!: number;
  @Column({ type: 'bigint', nullable: true }) default_cancellation_policy_id!:
    string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  @Column({ type: 'bigint' }) created_by!: string;
  @Column({ type: 'bigint' }) updated_by!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'owner_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_properties_owner_id',
    },
  ])
  relation_owner_id!: Relation<User>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'created_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_properties_created_by',
    },
  ])
  relation_created_by!: Relation<User>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'updated_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_properties_updated_by',
    },
  ])
  relation_updated_by!: Relation<User>;
  @ManyToOne(() => RentalCancellationPolicy, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'id',
      referencedColumnName: 'property_id',
      foreignKeyConstraintName:
        'fk_rental_properties_id_default_cancellation_policy_id',
    },
    {
      name: 'default_cancellation_policy_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName:
        'fk_rental_properties_id_default_cancellation_policy_id',
    },
  ])
  relation_id_default_cancellation_policy_id!: Relation<RentalCancellationPolicy> | null;
}
