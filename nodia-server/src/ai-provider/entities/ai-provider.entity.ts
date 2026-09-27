import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { AiConnectionMode } from '../types/ai-provider.types.js';
import { AiApiKey } from './ai-api-key.entity.js';
import { AiProviderEvent } from './ai-provider-event.entity.js';

@Entity({
  name: 'ai_providers',
})
export class AiProvider {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  key: string;

  @Column({ type: 'enum', enum: AiConnectionMode, default: AiConnectionMode.API_KEY })
  mode: AiConnectionMode;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  fields: Record<string, any>;

  @Column({ type: 'smallint', default: 1 })
  fields_version: number;

  @Column({ type: 'boolean', default: true })
  auto_rotate_api_keys: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => AiApiKey, (key) => key.provider)
  api_keys: Relation<AiApiKey[]>;

  @OneToMany(() => AiProviderEvent, (event) => event.provider)
  events: Relation<AiProviderEvent[]>;

  translates?: Array<{ key: string; es: string; en: string }>;
}
