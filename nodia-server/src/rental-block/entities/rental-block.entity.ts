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
import { User } from '../../user/entities/user.entity.js';

@Entity('rental_blocks')
@Index(
  'idx_rental_block_calendar',
  ['property_id', 'is_active', 'starts_at', 'id'],
  { unique: false },
)
@Check('ck_rental_blocks_ends_at', 'ends_at > starts_at')
export class RentalBlock {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) property_id!: string;
  @Column({ type: 'timestamptz' }) starts_at!: Date;
  @Column({ type: 'timestamptz' }) ends_at!: Date;
  @Column({ type: 'varchar', length: 255 }) reason!: string;
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
      foreignKeyConstraintName: 'fk_rental_blocks_property_id',
    },
  ])
  relation_property_id!: Relation<RentalProperty>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'created_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_blocks_created_by',
    },
  ])
  relation_created_by!: Relation<User>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'updated_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_blocks_updated_by',
    },
  ])
  relation_updated_by!: Relation<User>;
}
