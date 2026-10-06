import type { RentalOperationResponse } from '../../rental-common/types/rental.types.js';
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

@Entity('rental_operations')
@Index(
  'uq_rental_operation_request',
  ['property_id', 'actor_id', 'request_key'],
  { unique: true },
)
export class RentalOperation {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) property_id!: string;
  @Column({ type: 'bigint' }) actor_id!: string;
  @Column({ type: 'uuid' }) request_key!: string;
  @Column({ type: 'varchar', length: 100 }) operation!: string;
  @Column({ type: 'char', length: 64 }) request_hash!: string;
  @Column({ type: 'jsonb' }) response!: RentalOperationResponse;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @ManyToOne(() => RentalProperty, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'property_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_operations_property_id',
    },
  ])
  relation_property_id!: Relation<RentalProperty>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'actor_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_operations_actor_id',
    },
  ])
  relation_actor_id!: Relation<User>;
}
