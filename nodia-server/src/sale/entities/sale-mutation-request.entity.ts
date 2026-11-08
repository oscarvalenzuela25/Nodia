import { Column, Entity, PrimaryColumn } from 'typeorm';
import type {
  SaleOperation,
  SaleStatus,
  SaleView,
} from '../types/sale.types.js';

@Entity('sale_mutation_requests')
export class SaleMutationRequest {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid') business_id: string;
  @Column('bigint') actor_id: string;
  @Column('uuid') request_key: string;
  @Column('varchar') operation: SaleOperation;
  @Column('varchar') request_hash: string;
  @Column({ type: 'uuid', nullable: true }) sale_id: string | null;
  @Column({ type: 'integer', nullable: true }) result_version: number | null;
  @Column({ type: 'varchar', nullable: true }) result_status: SaleStatus | null;
  @Column({ type: 'jsonb', nullable: true }) result: SaleView | null;
  @Column('timestamptz') created_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) completed_at: Date | null;
}
