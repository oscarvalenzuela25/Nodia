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

@Entity('rental_expenses')
@Index('idx_rental_expense_listing', ['property_id', 'incurred_on', 'id'], {
  unique: false,
})
@Index('idx_rental_expense_cash', ['property_id', 'status', 'paid_on', 'id'], {
  unique: false,
})
@Index('idx_rental_expense_reservation', ['property_id', 'reservation_id'], {
  unique: false,
})
@Check('ck_rental_expenses_amount', 'amount > 0')
@Check('ck_rental_expenses_status', "status IN ('pending', 'paid', 'voided')")
@Check(
  'ck_rental_expenses_paid_date',
  '("status" = \'paid\' AND "paid_on" IS NOT NULL AND "paid_on" >= "incurred_on") OR ("status" <> \'paid\' AND "paid_on" IS NULL)',
)
export class RentalExpense {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) property_id!: string;
  @Column({ type: 'bigint', nullable: true }) reservation_id!: string | null;
  @Column({ type: 'varchar', length: 255 }) name!: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) category!:
    string | null;
  @Column({ type: 'bigint' }) amount!: string;
  @Column({ type: 'date' }) incurred_on!: string;
  @Column({ type: 'date', nullable: true }) paid_on!: string | null;
  @Column({ type: 'varchar', length: 16 }) status!: string;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'bigint' }) created_by!: string;
  @Column({ type: 'bigint' }) updated_by!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @ManyToOne(() => RentalProperty, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'property_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_expenses_property_id',
    },
  ])
  relation_property_id!: Relation<RentalProperty>;
  @ManyToOne(() => RentalReservation, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'property_id',
      referencedColumnName: 'property_id',
      foreignKeyConstraintName: 'fk_rental_expenses_property_id_reservation_id',
    },
    {
      name: 'reservation_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_expenses_property_id_reservation_id',
    },
  ])
  relation_property_id_reservation_id!: Relation<RentalReservation> | null;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'created_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_expenses_created_by',
    },
  ])
  relation_created_by!: Relation<User>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'updated_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_expenses_updated_by',
    },
  ])
  relation_updated_by!: Relation<User>;
}
