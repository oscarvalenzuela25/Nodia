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

  @Column({ type: 'varchar', length: 64, nullable: true })
  key?: string | null;

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
