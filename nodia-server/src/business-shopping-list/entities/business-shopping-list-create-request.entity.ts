import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../user/entities/user.entity.js';
import type { ShoppingListDetail } from '../types/shopping-list.types.js';
import { BusinessShoppingList } from './business-shopping-list.entity.js';

const primaryKeyConstraintName = 'pk_business_shopping_list_create_requests';

@Entity('business_shopping_list_create_requests')
@Check(
  'ck_business_shopping_list_create_requests_hash',
  "request_hash ~ '^[0-9a-f]{64}$'",
)
@Check(
  'ck_business_shopping_list_create_requests_result',
  "jsonb_typeof(result) = 'object'",
)
export class BusinessShoppingListCreateRequest {
  @PrimaryColumn('uuid', { primaryKeyConstraintName }) business_id: string;
  @PrimaryColumn('bigint', { primaryKeyConstraintName }) actor_id: string;
  @PrimaryColumn('uuid', { primaryKeyConstraintName }) request_key: string;
  @Column('uuid') list_id: string;
  @Column({ type: 'varchar', length: 64 }) request_hash: string;
  @Column('jsonb') result: ShoppingListDetail;
  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  created_at: Date;

  @ManyToOne(() => BusinessShoppingList, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn([
    {
      name: 'list_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName:
        'fk_business_shopping_list_create_requests_list',
    },
    {
      name: 'business_id',
      referencedColumnName: 'business_id',
      foreignKeyConstraintName:
        'fk_business_shopping_list_create_requests_list',
    },
  ])
  list: Relation<BusinessShoppingList>;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({
    name: 'actor_id',
    foreignKeyConstraintName: 'fk_business_shopping_list_create_requests_actor',
  })
  actor: Relation<User>;
}
