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
import type { RentalPolicySnapshot } from '../../rental-common/types/rental.types.js';
import { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import { RentalCancellationPolicy } from '../../rental-cancellation-policy/entities/rental-cancellation-policy.entity.js';
import { User } from '../../user/entities/user.entity.js';

@Entity('rental_reservations')
@Index('uq_rental_reservation_property_id', ['property_id', 'id'], {
  unique: true,
})
@Index(
  'idx_rental_reservation_calendar',
  ['property_id', 'check_in_on', 'id'],
  { unique: false },
)
@Index(
  'idx_rental_reservation_status',
  ['property_id', 'status', 'check_in_on', 'id'],
  { unique: false },
)
@Index(
  'uq_rental_reservation_external_reference',
  ['property_id', 'channel', 'external_reference'],
  { unique: true },
)
@Check('ck_rental_reservations_guests_count', 'guests_count > 0')
@Check(
  'ck_rental_reservations_channel',
  "channel IN ('whatsapp', 'airbnb', 'facebook', 'other')",
)
@Check('ck_rental_reservations_check_out_on', 'check_out_on > check_in_on')
@Check('ck_rental_reservations_nightly_rate', 'nightly_rate > 0')
@Check('ck_rental_reservations_cleaning_fee', 'cleaning_fee >= 0')
@Check('ck_rental_reservations_discount_amount', 'discount_amount >= 0')
@Check('ck_rental_reservations_total_amount', 'total_amount > 0')
@Check(
  'ck_rental_reservations_commission_amount',
  'commission_amount >= 0 AND commission_amount <= total_amount',
)
@Check(
  'ck_rental_reservations_deposit_amount',
  'deposit_amount >= 0 AND deposit_amount <= total_amount',
)
@Check(
  'ck_rental_reservations_status',
  "status IN ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')",
)
@Check('ck_rental_reservations_refund_amount', 'refund_amount >= 0')
@Check(
  'ck_rental_reservations_total_formula',
  '"total_amount"::numeric = ("check_out_on" - "check_in_on")::numeric * "nightly_rate"::numeric + "cleaning_fee"::numeric - "discount_amount"::numeric',
)
@Check(
  'ck_rental_reservations_cancellation',
  '("status" = \'cancelled\' AND "cancelled_at" IS NOT NULL AND "refund_amount" IS NOT NULL AND "cancellation_snapshot" IS NOT NULL) OR ("status" <> \'cancelled\' AND "cancelled_at" IS NULL AND "refund_amount" IS NULL AND "cancellation_snapshot" IS NULL)',
)
export class RentalReservation {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) property_id!: string;
  @Column({ type: 'varchar', length: 255 }) guest_name!: string;
  @Column({ type: 'varchar', length: 255 }) guest_contact!: string;
  @Column({ type: 'integer' }) guests_count!: number;
  @Column({ type: 'varchar', length: 32 }) channel!: string;
  @Column({ type: 'varchar', length: 255, nullable: true })
  external_reference!: string | null;
  @Column({ type: 'date' }) check_in_on!: string;
  @Column({ type: 'date' }) check_out_on!: string;
  @Column({ type: 'time' }) check_in_time!: string;
  @Column({ type: 'time' }) check_out_time!: string;
  @Column({ type: 'bigint' }) nightly_rate!: string;
  @Column({ type: 'bigint', default: 0 }) cleaning_fee!: string;
  @Column({ type: 'bigint', default: 0 }) discount_amount!: string;
  @Column({ type: 'bigint' }) total_amount!: string;
  @Column({ type: 'bigint', default: 0 }) commission_amount!: string;
  @Column({ type: 'bigint' }) deposit_amount!: string;
  @Column({ type: 'timestamptz', nullable: true }) deposit_due_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) balance_due_at!: Date | null;
  @Column({ type: 'bigint', nullable: true }) cancellation_policy_id!:
    string | null;
  @Column({ type: 'jsonb', nullable: true })
  policy_snapshot!: RentalPolicySnapshot | null;
  @Column({ type: 'varchar', length: 32 }) status!: string;
  @Column({ type: 'timestamptz', nullable: true }) cancelled_at!: Date | null;
  @Column({ type: 'bigint', nullable: true }) refund_amount!: string | null;
  @Column({ type: 'jsonb', nullable: true }) cancellation_snapshot!: Record<
    string,
    unknown
  > | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  @Column({ type: 'bigint' }) created_by!: string;
  @Column({ type: 'bigint' }) updated_by!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @ManyToOne(() => RentalProperty, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'property_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_reservations_property_id',
    },
  ])
  relation_property_id!: Relation<RentalProperty>;
  @ManyToOne(() => RentalCancellationPolicy, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'property_id',
      referencedColumnName: 'property_id',
      foreignKeyConstraintName:
        'fk_rental_reservations_property_id_cancellation_policy_id',
    },
    {
      name: 'cancellation_policy_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName:
        'fk_rental_reservations_property_id_cancellation_policy_id',
    },
  ])
  relation_property_id_cancellation_policy_id!: Relation<RentalCancellationPolicy> | null;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'created_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_reservations_created_by',
    },
  ])
  relation_created_by!: Relation<User>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'updated_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_reservations_updated_by',
    },
  ])
  relation_updated_by!: Relation<User>;
}
