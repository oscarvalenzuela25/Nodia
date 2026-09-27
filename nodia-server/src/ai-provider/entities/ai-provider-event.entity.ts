import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { AiProvider } from './ai-provider.entity.js';
import { AiApiKey } from './ai-api-key.entity.js';
import { User } from '../../user/entities/user.entity.js';

@Entity({
  name: 'ai_provider_events',
})
@Index('idx_ai_provider_events_recent', ['provider_id', 'created_at'])
@Index('idx_ai_api_key_events_recent', ['api_key_id', 'created_at'])
export class AiProviderEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  provider_id: string;

  @Column({ type: 'bigint', nullable: true })
  api_key_id: string | null;

  @Column({ type: 'bigint', nullable: true })
  actor_user_id: string | null;

  @Column({ type: 'varchar', length: 64 })
  event_type: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  reason_code: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => AiProvider, (provider) => provider.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: Relation<AiProvider>;

  @ManyToOne(() => AiApiKey, (apiKey) => apiKey.events, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'api_key_id' })
  api_key: Relation<AiApiKey> | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor_user: Relation<User> | null;
}
