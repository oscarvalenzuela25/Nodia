import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { RentalProperty } from '../../rental-property/entities/rental-property.entity.js';
import { User } from '../../user/entities/user.entity.js';

@Entity('rental_collaborators')
@Index('uq_rental_collaborator', ['property_id', 'user_id'], { unique: true })
@Index(
  'idx_rental_collaborator_access',
  ['user_id', 'is_active', 'property_id'],
  { unique: false },
)
export class RentalCollaborator {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: string;
  @Column({ type: 'bigint' }) property_id!: string;
  @Column({ type: 'bigint' }) user_id!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) position!:
    string | null;
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
      foreignKeyConstraintName: 'fk_rental_collaborators_property_id',
    },
  ])
  relation_property_id!: Relation<RentalProperty>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'user_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_collaborators_user_id',
    },
  ])
  relation_user_id!: Relation<User>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'created_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_collaborators_created_by',
    },
  ])
  relation_created_by!: Relation<User>;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    {
      name: 'updated_by',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_rental_collaborators_updated_by',
    },
  ])
  relation_updated_by!: Relation<User>;
}
