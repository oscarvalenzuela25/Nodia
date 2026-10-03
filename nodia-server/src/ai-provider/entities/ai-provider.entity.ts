import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { AiConnectionMode } from '../types/ai-provider.types.js';
import { AiApiKey } from './ai-api-key.entity.js';
import { AiProviderEvent } from './ai-provider-event.entity.js';
import { AiProviderCatalog } from './ai-provider-catalog.entity.js';

@Entity({
  name: 'ai_providers',
})
export class AiProvider {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint', nullable: true })
  catalog_id?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  name?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  fields: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  auto_rotate_api_keys: boolean;

  @Column({ type: 'boolean', default: false })
  use_api_key: boolean;

  @Column({ type: 'boolean', default: false })
  use_token_plan_web: boolean;

  @Column({ type: 'boolean', default: false })
  use_token_plan_agentic: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true, default: null })
  default_mode?: 'api_key' | 'token_plan_web' | 'token_plan_agentic' | null;

  get key(): string | undefined {
    return this.catalog?.key;
  }

  get mode(): string | null {
    if (this.default_mode) return this.default_mode;
    if (this.use_token_plan_agentic) return 'token_plan_agentic';
    if (this.use_token_plan_web) return 'web_session';
    if (this.use_api_key) return 'api_key';
    return null;
  }

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => AiProviderCatalog, (cat) => cat.providers, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'catalog_id' })
  catalog?: Relation<AiProviderCatalog> | null;

  @OneToMany(() => AiApiKey, (key) => key.provider)
  api_keys: Relation<AiApiKey[]>;

  @OneToMany(() => AiProviderEvent, (event) => event.provider)
  events: Relation<AiProviderEvent[]>;

  translates?: Array<{ key: string; es: string; en: string }>;
}
