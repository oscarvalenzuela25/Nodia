import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { SaleOperation } from '../types/sale.types.js';

@Entity('sale_events')
export class SaleEvent {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid') business_id: string;
  @Column('uuid') sale_id: string;
  @Column('integer') sale_version: number;
  @Column('varchar') event_type: SaleOperation;
  @Column('bigint') actor_id: string;
  @Column('varchar') origin: 'http' | 'nodia_ai';
  @Column('uuid') mutation_request_id: string;
  @Column('timestamptz') occurred_at: Date;
  @Column('jsonb') changes: Record<string, string | number | null>;
}
