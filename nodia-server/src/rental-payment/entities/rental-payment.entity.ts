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
import { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import { RentalReservation } from '../../rental-reservation/entities/rental-reservation.entity.js';
import { User } from '../../user/entities/user.entity.js';

@Entity('rental_payments')
@Index(
  'idx_rental_payment_balance',
  ['property_id', 'reservation_id', 'type', 'status'],
  { unique: false },
)
@Index('idx_rental_payment_cash', ['property_id', 'occurred_on', 'id'], {
  unique: false,
})
@Check('ck_rental_payments_type', "type IN ('payment', 'refund')")
@Check('ck_rental_payments_amount', 'amount > 0')
@Check('ck_rental_payments_status', "status IN ('confirmed', 'voided')")
export class RentalPayment {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) property_id!: string;
  @Column({ type: 'bigint' }) reservation_id!: string;
  @Column({ type: 'varchar', length: 16 }) type!: string;
  @Column({ type: 'bigint' }) amount!: string;
  @Column({ type: 'date' }) occurred_on!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) method!:
    string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) reference!:
    string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'varchar', length: 16 }) status!: string;
  @Column({ type: 'bigint' }) created_by!: string;
  @Column({ type: 'bigint' }) updated_by!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @ManyToOne(() => RentalProperty, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'property_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_payments_property_id',
    },
  ])
  relation_property_id!: Relation<RentalProperty>;
  @ManyToOne(() => RentalReservation, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'property_id',
      referencedColumnName: 'property_id',
      foreignKeyConstraintName: 'fk_rental_payments_property_id_reservation_id',
    },
    {
      name: 'reservation_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_payments_property_id_reservation_id',
    },
  ])
  relation_property_id_reservation_id!: Relation<RentalReservation>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'created_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_payments_created_by',
    },
  ])
  relation_created_by!: Relation<User>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'updated_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_payments_updated_by',
    },
  ])
  relation_updated_by!: Relation<User>;
}
