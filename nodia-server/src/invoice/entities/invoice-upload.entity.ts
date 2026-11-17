import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

/** Durable recovery intent, created before any R2 side effect. No invoice FK. */
@Entity({ name: 'invoice_uploads' })
@Check(
  'ck_invoice_uploads_cash_upload',
  'uploaded_at IS NULL OR cash_attempt_id IS NOT NULL',
)
@Unique('uq_invoice_uploads_cash_attempt', ['cash_attempt_id'])
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

  @Column({ type: 'uuid', nullable: true })
  cash_attempt_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  uploaded_at: Date | null;
}
