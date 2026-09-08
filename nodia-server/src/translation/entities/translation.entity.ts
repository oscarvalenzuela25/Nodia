import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({
  name: 'translations',
})
@Index(
  'uq_translation_entity_id_key_locale',
  ['source_entity', 'source_id', 'source_key', 'locale'],
  { unique: true },
)
@Index('idx_translation_lookup', ['locale', 'source_entity', 'source_id'])
export class Translation {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 255 })
  source_entity: string;

  @Column({ type: 'varchar', length: 255 })
  source_id: string;

  @Column({ type: 'varchar', length: 255 })
  source_key: string;

  @Column({ type: 'varchar', length: 10 })
  locale: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}

