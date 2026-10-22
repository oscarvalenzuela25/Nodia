import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** Immutable derived content; canonical messages and business receipts remain authoritative. */
@Entity('nodia_ai_context_snapshots')
export class NodiaAiContextSnapshot {
  @PrimaryColumn({ type: 'uuid' }) id!: string;
  @Column({ type: 'uuid' }) conversation_id!: string;
  @Column({ type: 'integer' }) revision!: number;
  @Column({ type: 'bigint' }) through_message_seq!: string;
  @Column({ type: 'char', length: 64 }) source_hash!: string;
  @Column({ type: 'jsonb' }) summary!: NodiaAiJsonObject;
  @Column({ type: 'jsonb' }) scope_manifest!: NodiaAiJsonObject;
  @Column({ type: 'text' }) builder_contract_version!: string;
  @Column({ type: 'timestamptz', default: () => 'now()' }) created_at!: Date;
}
