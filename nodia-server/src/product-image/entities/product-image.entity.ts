import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity.js';

export type ProductImageStatus =
  'pending' | 'uploading' | 'ready' | 'pending_delete' | 'deleted' | 'failed';

@Entity('product_images')
@Index('uq_product_images_current', ['product_id'], {
  unique: true,
  where: '"is_current"',
})
export class ProductImage {
  @PrimaryColumn({ type: 'uuid' }) id: string;
  @Column({ type: 'uuid' }) business_id: string;
  @Column({ type: 'bigint', nullable: true }) product_id: string | null;
  @Column({ type: 'bigint' }) uploaded_by: string;
  @Column({ type: 'varchar', length: 255, unique: true }) storage_key: string;
  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: ProductImageStatus;
  @Column({ type: 'boolean', default: false }) is_current: boolean;
  @Column({ type: 'varchar', length: 80, nullable: true }) mime_type:
    string | null;
  @Column({ type: 'integer', nullable: true }) byte_size: number | null;
  @Column({ type: 'integer', nullable: true }) width: number | null;
  @Column({ type: 'integer', nullable: true }) height: number | null;
  @Column({ type: 'char', length: 64, nullable: true }) sha256: string | null;
  @Column({ type: 'integer', nullable: true }) product_version: number | null;
  @Column({ type: 'integer' }) reserved_product_version: number;
  @Column({ type: 'timestamptz', default: () => 'clock_timestamp()' })
  created_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) ready_at: Date | null;
  @Column({ type: 'timestamptz' }) cleanup_after: Date;
  @Column({ type: 'timestamptz' }) retry_after: Date;
  @Column({ type: 'integer', default: 0 }) cleanup_attempts: number;
  @ManyToOne(() => Product, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'business_id', referencedColumnName: 'business_id' },
    { name: 'product_id', referencedColumnName: 'id' },
  ])
  product: Relation<Product> | null;
}
