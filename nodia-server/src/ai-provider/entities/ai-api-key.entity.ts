import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { AiKeyHealthState } from '../types/ai-provider.types.js';
import { AiProvider } from './ai-provider.entity.js';
import { AiProviderEvent } from './ai-provider-event.entity.js';

@Entity({
  name: 'ai_api_keys',
})
@Index('uq_ai_api_key_fingerprint', ['provider_id', 'secret_fingerprint'], {
  unique: true,
})
@Index('idx_ai_api_key_rotation', ['provider_id', 'sort_order', 'id'])
@Index('idx_ai_api_key_selection', ['provider_id', 'is_selected'])
export class AiApiKey {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  provider_id: string;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'text', select: false })
  secret_ciphertext: string;

  @Column({ type: 'varchar', length: 64, select: false })
  secret_fingerprint: string;

  @Column({ type: 'varchar', length: 16 })
  display_hint: string;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'boolean', default: false })
  is_selected: boolean;

  @Column({
    type: 'enum',
    enum: AiKeyHealthState,
    default: AiKeyHealthState.UNTESTED,
  })
  health_state: AiKeyHealthState;

  @Column({ type: 'varchar', length: 64, nullable: true })
  last_error_code: string | null;

  @Column({ type: 'text', nullable: true })
  last_error_message: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_error_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_success_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cooldown_until: Date | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => AiProvider, (provider) => provider.api_keys, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'provider_id' })
  provider: Relation<AiProvider>;

  @OneToMany(() => AiProviderEvent, (event) => event.api_key)
  events: Relation<AiProviderEvent[]>;
}
