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
import { Provider } from '../../provider/entities/provider.entity.js';
import type {
  ContactPhone,
  ContactSchedule,
} from '../types/provider-contact.types.js';

@Entity('personal_info_provider')
@Index('idx_provider_contact_provider', ['provider_id', 'id'])
@Index('uq_provider_contact_creation', ['provider_id', 'creation_key'], {
  unique: true,
})
export class ProviderContact {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id: string;
  @Column({ type: 'bigint' }) provider_id: string;
  @Column({ type: 'varchar', length: 255 }) name: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  phone: ContactPhone[];
  @Column({ type: 'varchar', length: 254, nullable: true }) email:
    string | null;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  schedule: ContactSchedule;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'boolean', default: true }) is_active: boolean;
  @Column({ type: 'int', default: 1 }) version: number;
  @Column({ type: 'uuid', select: false }) creation_key: string;
  @Column({ type: 'char', length: 64, select: false }) creation_hash: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
  @ManyToOne(() => Provider, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'provider_id' })
  provider: Relation<Provider>;
}
