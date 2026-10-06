import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import { User } from '../../user/entities/user.entity.js';

@Entity('rental_audit_events')
@Index('idx_rental_audit_history', ['property_id', 'created_at', 'id'], {
  unique: false,
})
@Index(
  'idx_rental_audit_resource',
  ['property_id', 'resource_type', 'resource_id', 'id'],
  { unique: false },
)
export class RentalAuditEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) property_id!: string;
  @Column({ type: 'bigint' }) actor_id!: string;
  @Column({ type: 'varchar', length: 100 }) action!: string;
  @Column({ type: 'varchar', length: 64 }) resource_type!: string;
  @Column({ type: 'bigint' }) resource_id!: string;
  @Column({ type: 'jsonb' }) changes!: Record<string, unknown>;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @ManyToOne(() => RentalProperty, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'property_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_audit_events_property_id',
    },
  ])
  relation_property_id!: Relation<RentalProperty>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'actor_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_audit_events_actor_id',
    },
  ])
  relation_actor_id!: Relation<User>;
}
