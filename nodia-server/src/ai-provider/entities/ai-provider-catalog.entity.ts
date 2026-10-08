import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { AiProvider } from './ai-provider.entity.js';

@Entity({
  name: 'ai_provider_catalog',
})
export class AiProviderCatalog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'boolean', default: false })
  can_use_api_key: boolean;

  @Column({ type: 'boolean', default: false })
  can_use_token_plan_web: boolean;

  @Column({ type: 'boolean', default: false })
  can_use_token_plan_agentic: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => AiProvider, (provider) => provider.catalog)
  providers: Relation<AiProvider[]>;
}
