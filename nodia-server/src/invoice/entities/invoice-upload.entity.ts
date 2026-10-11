import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Durable recovery intent, created before any R2 side effect. No invoice FK. */
@Entity({ name: 'invoice_uploads' })
export class InvoiceUpload {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  storage_key: string;

  @Column({ type: 'timestamptz' })
  cleanup_after: Date;

  @Index('idx_invoice_uploads_retry_after')
  @Column({ type: 'timestamptz' })
  retry_after: Date;

  @Column({ type: 'boolean', default: false })
  cleanup_started: boolean;

  @Column({ type: 'integer', default: 0 })
  cleanup_attempts: number;
}
