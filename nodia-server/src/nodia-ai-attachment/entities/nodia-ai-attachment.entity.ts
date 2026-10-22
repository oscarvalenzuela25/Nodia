import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiAttachmentKind } from '../types/attachment-ports.js';

@Entity('nodia_ai_attachments')
export class NodiaAiAttachment {
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ type: 'uuid' }) conversation_id!: string;
  @Column({ type: 'uuid' }) client_request_id!: string;
  @Column({ type: 'char', length: 64 }) request_hash!: string;
  @Column({ type: 'bigint' }) retention_epoch!: string;
  @Column({ type: 'text' }) kind!: NodiaAiAttachmentKind;
  @Column({ type: 'text' }) state!:
    'uploading' | 'ready' | 'rejected' | 'expired';
  @Column({ type: 'text' }) file_name!: string;
  @Column({ type: 'text' }) storage_key!: string;
  @Column({ type: 'uuid' }) generation!: string;
  @Column({ type: 'bigint' }) reserved_bytes!: string;
  @Column({ type: 'bigint', nullable: true }) byte_count!: string | null;
  @Column({ type: 'text', nullable: true }) media_type!: string | null;
  @Column({ type: 'char', length: 64, nullable: true }) content_hash!:
    string | null;
  @Column({ type: 'integer', nullable: true }) page_count!: number | null;
  @Column({ type: 'double precision', nullable: true }) duration_seconds!:
    number | null;
  @Column({ type: 'text', nullable: true }) interpretation_text!: string | null;
  @Column({ type: 'integer', default: 0 }) interpretation_revision!: number;
  @Column({ type: 'boolean', default: false })
  interpretation_reviewed!: boolean;
  @Column({ type: 'text', nullable: true }) interpretation_origin!:
    'user_reviewed' | 'provider' | 'extracted' | null;
  @Column({ type: 'timestamptz' }) expires_at!: Date;
  @Column({ type: 'timestamptz', nullable: true })
  processing_started_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) write_until_at!: Date | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) created_at!: Date;
  @Column({ type: 'timestamptz', default: () => 'now()' }) updated_at!: Date;
}
