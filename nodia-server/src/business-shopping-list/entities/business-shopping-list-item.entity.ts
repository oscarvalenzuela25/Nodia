import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { User } from '../../user/entities/user.entity.js';
import { BusinessShoppingList } from './business-shopping-list.entity.js';

@Entity('business_shopping_list_items')
@Unique('uq_business_shopping_list_items_product', ['list_id', 'product_id'])
@Unique('uq_business_shopping_list_items_position', ['list_id', 'position'], {
  deferrable: 'INITIALLY DEFERRED',
})
@Check('ck_business_shopping_list_items_product', 'product_id > 0')
@Check(
  'ck_business_shopping_list_items_quantity',
  'quantity BETWEEN 0.001 AND 999999999.999',
)
@Check('ck_business_shopping_list_items_position', 'position BETWEEN 0 AND 499')
@Check(
  'ck_business_shopping_list_items_check_metadata',
  `(check_version = 1 AND NOT checked AND checked_at IS NULL AND checked_by IS NULL)
  OR (check_version > 1 AND checked_at IS NOT NULL AND checked_by IS NOT NULL)`,
)
export class BusinessShoppingListItem {
  @PrimaryColumn('uuid', {
    primaryKeyConstraintName: 'pk_business_shopping_list_items',
  })
  id: string;

  @Column('uuid') list_id: string;
  @Column('uuid') business_id: string;
  // Historical source identity survives catalog moves and removals.
  @Column('bigint') product_id: string;
  @Column({ type: 'varchar', length: 255 }) product_name: string;
  @Column({ type: 'numeric', precision: 12, scale: 3 }) quantity: string;
  @Column('integer') position: number;
  @Column({ type: 'boolean', default: false }) checked: boolean;
  @Column({ type: 'integer', default: 1 }) check_version: number;
  @Column({ type: 'timestamptz', nullable: true }) checked_at: Date | null;
  @Column({ type: 'bigint', nullable: true }) checked_by: string | null;

  @ManyToOne(() => BusinessShoppingList, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'list_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_business_shopping_list_items_list',
    },
    {
      name: 'business_id',
      referencedColumnName: 'business_id',
      foreignKeyConstraintName: 'fk_business_shopping_list_items_list',
    },
  ])
  list: Relation<BusinessShoppingList>;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({
    name: 'checked_by',
    foreignKeyConstraintName: 'fk_business_shopping_list_items_checked_by',
  })
  checkActor: Relation<User> | null;
}
