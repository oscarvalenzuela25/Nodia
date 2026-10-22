import { Column, Entity, PrimaryColumn } from 'typeorm';
import type {
  NodiaAiSelection,
  NodiaAiJsonObject,
  NodiaAiRoutingSnapshot,
  NodiaAiBudgetSnapshot,
} from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_runs')
export class NodiaAiRun {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  conversation_id!: string;

  @Column({ type: 'bigint' })
  actor_id!: string;

  @Column({ type: 'uuid' })
  user_message_id!: string;

  @Column({ type: 'uuid', nullable: true })
  assistant_message_id!: string | null;

  @Column({ type: 'bigint', nullable: true })
  connection_id!: string | null;

  @Column({ type: 'jsonb' })
  selection_snapshot!: NodiaAiSelection;

  @Column({ type: 'text' })
  catalog_version!: string;

  @Column({ type: 'text' })
  policy_version!: string;

  @Column({ type: 'uuid', nullable: true })
  context_snapshot_id!: string | null;

  @Column({ type: 'bigint' })
  input_through_seq!: string;

  @Column({ type: 'integer', default: 1 })
  revision!: number;

  @Column({ type: 'text' })
  state!: string;

  @Column({ type: 'text' })
  phase!: string;

  @Column({ type: 'timestamptz' })
  deadline_at!: Date;

  @Column({ type: 'text', nullable: true })
  error_code!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;

  @Column({ type: 'bigint', default: '1' })
  retention_epoch!: string;

  @Column({ type: 'jsonb' })
  context_manifest!: NodiaAiJsonObject;

  @Column({ type: 'jsonb' })
  routing_snapshot!: NodiaAiRoutingSnapshot;

  @Column({ type: 'char', length: 64 })
  policy_hash!: string;

  @Column({ type: 'jsonb' })
  budget_snapshot!: NodiaAiBudgetSnapshot;

  @Column({ type: 'integer', default: 0 })
  tool_calls_used!: number;

  @Column({ type: 'integer', default: 0 })
  mcp_rpc_messages_used!: number;

  @Column({ type: 'integer', default: 0 })
  provider_dispatches_used!: number;

  @Column({ type: 'integer', default: 0 })
  compactions_used!: number;

  @Column({ type: 'integer', default: 0 })
  delegations_used!: number;
}
