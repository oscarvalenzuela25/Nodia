import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_tool_calls')
export class NodiaAiToolCall {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  conversation_id!: string;

  @Column({ type: 'uuid' })
  run_id!: string;

  @Column({ type: 'text' })
  adapter_call_id!: string;

  @Column({ type: 'text' })
  tool_name!: string;

  @Column({ type: 'char', length: 64 })
  contract_hash!: string;

  @Column({ type: 'char', length: 64 })
  arguments_hash!: string;

  @Column({ type: 'jsonb' })
  arguments!: NodiaAiJsonObject;

  @Column({ type: 'jsonb', nullable: true })
  public_result!: NodiaAiJsonObject | null;

  @Column({ type: 'jsonb' })
  scope_manifest!: NodiaAiJsonObject;

  @Column({ type: 'text' })
  state!: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;
}
