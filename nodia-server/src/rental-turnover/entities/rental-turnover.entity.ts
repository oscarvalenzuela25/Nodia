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

@Entity('rental_turnovers')
@Index('uq_rental_turnover_incoming', ['incoming_reservation_id'], {
  unique: true,
})
@Index(
  'idx_rental_turnover_listing',
  ['property_id', 'planned_ready_at', 'id'],
  { unique: false },
)
@Index(
  'idx_rental_turnover_previous',
  ['property_id', 'previous_reservation_id'],
  { unique: false },
)
@Check(
  'ck_rental_turnovers_previous_reservation_id',
  'previous_reservation_id <> incoming_reservation_id',
)
@Check(
  'ck_rental_turnovers_cleaning_status',
  "cleaning_status IN ('pending', 'in_progress', 'completed')",
)
@Check(
  'ck_rental_turnovers_readiness',
  '"ready_at" IS NULL OR ("linen_ready" IS TRUE AND "cleaning_status" = \'completed\')',
)
export class RentalTurnover {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) property_id!: string;
  @Column({ type: 'bigint' }) incoming_reservation_id!: string;
  @Column({ type: 'bigint', nullable: true }) previous_reservation_id!:
    string | null;
  @Column({ type: 'boolean', nullable: true }) linen_ready!: boolean | null;
  @Column({ type: 'varchar', length: 16 }) cleaning_status!: string;
  @Column({ type: 'timestamptz', nullable: true })
  planned_ready_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) ready_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true })
  same_day_approved_at!: Date | null;
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
      foreignKeyConstraintName: 'fk_rental_turnovers_property_id',
    },
  ])
  relation_property_id!: Relation<RentalProperty>;
  @ManyToOne(() => RentalReservation, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'property_id',
      referencedColumnName: 'property_id',
      foreignKeyConstraintName:
        'fk_rental_turnovers_property_id_incoming_reservation_id',
    },
    {
      name: 'incoming_reservation_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName:
        'fk_rental_turnovers_property_id_incoming_reservation_id',
    },
  ])
  relation_property_id_incoming_reservation_id!: Relation<RentalReservation>;
  @ManyToOne(() => RentalReservation, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'property_id',
      referencedColumnName: 'property_id',
      foreignKeyConstraintName:
        'fk_rental_turnovers_property_id_previous_reservation_id',
    },
    {
      name: 'previous_reservation_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName:
        'fk_rental_turnovers_property_id_previous_reservation_id',
    },
  ])
  relation_property_id_previous_reservation_id!: Relation<RentalReservation> | null;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'created_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_turnovers_created_by',
    },
  ])
  relation_created_by!: Relation<User>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'updated_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_turnovers_updated_by',
    },
  ])
  relation_updated_by!: Relation<User>;
}
