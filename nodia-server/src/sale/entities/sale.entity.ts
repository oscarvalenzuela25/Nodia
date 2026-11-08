import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Business } from '../../business/entities/business.entity.js';
import type { SalePaymentMethod, SaleStatus } from '../types/sale.types.js';

@Entity('sales')
export class Sale {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid') business_id: string;
  @Column('varchar') status: SaleStatus;
  @Column('varchar') currency: 'CLP';
  @Column('varchar') payment_method: SalePaymentMethod;
  @Column({ type: 'varchar', nullable: true }) payment_method_description:
    string | null;
  @Column('bigint') total_amount: string;
  @Column('integer') version: number;
  @Column('bigint') created_by: string;
  @Column('bigint') updated_by: string;
  @Column({ type: 'bigint', nullable: true }) completed_by: string | null;
  @Column({ type: 'bigint', nullable: true }) cancelled_by: string | null;
  @Column('timestamptz') created_at: Date;
  @Column('timestamptz') updated_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) completed_at: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) cancelled_at: Date | null;
  @Column({ type: 'varchar', nullable: true }) cancellation_reason:
    string | null;
  @ManyToOne(() => Business, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;
}
