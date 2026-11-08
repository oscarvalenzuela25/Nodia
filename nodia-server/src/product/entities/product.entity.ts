import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity.js';
import { Provider } from '../../provider/entities/provider.entity.js';
import { ProductLog } from './product-log.entity.js';
import type { ProductMeasurementUnit } from '../product-measurement-unit.js';

@Entity({
  name: 'products',
})
@Index('uq_business_product_code', ['business_id', 'code'], { unique: true })
@Index('uq_products_business_id_id', ['business_id', 'id'], { unique: true })
@Index('uq_products_business_barcode', ['business_id', 'barcode'], {
  unique: true,
  where: '"barcode" IS NOT NULL',
})
export class Product {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('idx_products_business_id')
  @Column({ type: 'uuid' })
  business_id: string;

  @Index('idx_products_provider_id')
  @Column({ type: 'bigint', nullable: true })
  provider_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 16, default: 'unit' })
  measurement_unit: ProductMeasurementUnit;

  @Column({ type: 'varchar', length: 255, nullable: true })
  barcode: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'integer' })
  cost_price: number;

  @Column({ type: 'integer' })
  cost_price_tax: number;

  @Column({ type: 'integer' })
  sale_price: number;

  @Column({ type: 'integer', nullable: true })
  offer_price: number | null;

  @Column({ type: 'boolean', default: false })
  is_offer_enabled: boolean;

  @Column({ type: 'boolean', nullable: true })
  has_stock: boolean | null;

  @Column({ type: 'integer', default: 1 })
  version: number;

  effective_price?: string | null;
  price_source?: 'regular' | 'offer' | null;
  previous_price_snapshot?: ProductLog | null;
  image?: {
    id: string;
    url: string;
    mime_type: string;
    width: number;
    height: number;
    byte_size: number;
  } | null;

  @Column({ type: 'integer', default: 0 })
  stock: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Business, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  @ManyToOne(() => Provider, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'provider_id' })
  provider: Relation<Provider> | null;

  @OneToMany(() => ProductLog, (log) => log.product)
  logs: Relation<ProductLog>[];
}
