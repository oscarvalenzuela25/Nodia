import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  VirtualColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity.js';
import { Provider } from '../../provider/entities/provider.entity.js';
import {
  invoiceCashExpenseProjection,
  type InvoiceCashExpenseProjection,
} from '../invoice-cash-projection.js';

@Entity({
  name: 'invoices',
})
@Unique('uq_invoices_id_business', ['id', 'business_id'])
@Check('ck_invoices_version', 'version > 0')
export class Invoice {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('idx_invoices_business_id')
  @Column({ type: 'uuid' })
  business_id: string;

  @Index('idx_invoices_provider_id')
  @Column({ type: 'bigint', nullable: true })
  provider_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  code: string | null;

  @Column({ type: 'integer', default: 0 })
  total_amount: number;

  @Index('idx_invoices_path_storage')
  @Column({ type: 'varchar', length: 255, default: '' })
  path_storage: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  data: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @VirtualColumn({
    type: 'jsonb',
    select: false,
    query: invoiceCashExpenseProjection,
  })
  cash_expense?: InvoiceCashExpenseProjection | null;

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
}
