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
import { Business } from '../../business/entities/business.entity.js';
import { Provider } from '../../provider/entities/provider.entity.js';

@Entity({
  name: 'invoices',
})
export class Invoice {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('idx_invoices_business_id')
  @Column({ type: 'uuid' })
  business_id: string;

  @Index('idx_invoices_provider_id')
  @Column({ type: 'bigint', nullable: true })
  provider_id: string | null;

  @Column({ type: 'varchar', length: 255 })
  code: string;

  @Column({ type: 'integer', default: 0 })
  total_amount: number;

  @Column({ type: 'varchar', length: 255, default: '' })
  path_storage: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  data: Record<string, any>;

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
}
