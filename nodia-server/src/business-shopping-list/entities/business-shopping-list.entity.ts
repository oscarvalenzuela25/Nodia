import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity.js';

@Entity('business_shopping_lists')
@Unique('uq_business_shopping_lists_id_business', ['id', 'business_id'])
@Index('idx_business_shopping_lists_name', ['business_id', 'name', 'id'])
@Check('ck_business_shopping_lists_name', "name ~ '[^[:space:]]'")
@Check('ck_business_shopping_lists_version', 'version > 0')
export class BusinessShoppingList {
  @PrimaryColumn('uuid', {
    primaryKeyConstraintName: 'pk_business_shopping_lists',
  })
  id: string;

  @Column('uuid') business_id: string;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'integer', default: 1 }) version: number;
  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  created_at: Date;
  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  updated_at: Date;

  @ManyToOne(() => Business, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'business_id',
    foreignKeyConstraintName: 'fk_business_shopping_lists_business',
  })
  business: Relation<Business>;
}
