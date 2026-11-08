import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity.js';
import { Sale } from './sale.entity.js';
import type { ProductMeasurementUnit } from '../../product/product-measurement-unit.js';
import { saleQuantityTransformer } from '../policies/sale-quantity.js';

@Entity('sale_items')
export class SaleItem {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid') business_id: string;
  @Column('uuid') sale_id: string;
  @Column('bigint') product_id: string;
  @Column('integer') position: number;
  @Column({ type: 'numeric', transformer: saleQuantityTransformer })
  quantity: number;
  @Column({ type: 'varchar', nullable: true }) product_code_snapshot:
    string | null;
  @Column({ type: 'varchar', length: 16, default: 'unit' })
  measurement_unit_snapshot: ProductMeasurementUnit;
  @Column({ type: 'varchar', nullable: true }) product_barcode_snapshot:
    string | null;
  @Column('varchar') product_name_snapshot: string;
  @Column('bigint') regular_unit_price: string;
  @Column({ type: 'bigint', nullable: true }) offer_price_snapshot:
    string | null;
  @Column('boolean') is_offer_enabled_snapshot: boolean;
  @Column('varchar') price_source: 'regular' | 'offer' | 'manual';
  @Column('bigint') unit_price: string;
  @Column({ type: 'bigint', nullable: true }) cost_price_snapshot:
    string | null;
  @Column({ type: 'bigint', nullable: true }) cost_price_tax_snapshot:
    string | null;
  @Column('bigint') line_total: string;
  @Column('integer') product_version: number;
  @Column('timestamptz') created_at: Date;
  @Column('timestamptz') updated_at: Date;
  @ManyToOne(() => Sale, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'business_id', referencedColumnName: 'business_id' },
    { name: 'sale_id', referencedColumnName: 'id' },
  ])
  sale: Relation<Sale>;
  @ManyToOne(() => Product, { onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'business_id', referencedColumnName: 'business_id' },
    { name: 'product_id', referencedColumnName: 'id' },
  ])
  product: Relation<Product>;
}
