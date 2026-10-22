import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

/** M1 storage shape. Constraints and referential integrity are frozen in migration1792200000000. */
@Entity('nodia_ai_execution_grants')
export class NodiaAiExecutionGrant {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'bigint' })
  actor_id!: string;

  @Column({ type: 'uuid', nullable: true })
  session_public_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  run_id!: string | null;

  @Column({ type: 'uuid', nullable: true })
  execution_id!: string | null;

  @Column({ type: 'char', length: 64, nullable: true })
  command_set_hash!: string | null;

  @Column({ type: 'jsonb' })
  allowed_modules!: string[];

  @Column({ type: 'jsonb' })
  allowed_operations!: string[];

  @Column({ type: 'jsonb' })
  allowed_scope!: NodiaAiJsonObject;

  @Column({ type: 'text' })
  policy_version!: string;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at!: Date | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  created_at!: Date;
}
