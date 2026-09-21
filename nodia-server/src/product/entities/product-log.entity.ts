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
import { Product } from './product.entity.js';

@Entity({
  name: 'product_logs',
})
export class ProductLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_product_logs_product_id')
  @Column({ type: 'bigint' })
  product_id: string;

  @Column({ type: 'varchar', length: 255 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'integer' })
  cost_price: number;

  @Column({ type: 'integer' })
  cost_price_tax: number;

  @Column({ type: 'integer' })
  profit_percentage: number;

  @Column({ type: 'integer' })
  sale_price: number;

  @Column({ type: 'integer', default: 0 })
  stock: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Product, (product) => product.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Relation<Product>;
}
