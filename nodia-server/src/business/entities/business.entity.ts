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
import { User } from '../../user/entities/user.entity.js';
import { BusinessCollaborator } from './business-collaborator.entity.js';

@Entity({
  name: 'businesses',
})
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index('idx_businesses_owner_id')
  @Column({ type: 'bigint' })
  owner_id: string;

  @Column({ type: 'boolean', default: false })
  has_description: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: Relation<User>;

  @OneToMany(() => BusinessCollaborator, (collaborator) => collaborator.business)
  collaborators: Relation<BusinessCollaborator>[];

  // Metadatos calculados en tiempo de consulta contextual
  user_role?: 'owner' | 'collaborator';
  user_position?: string | null;
  user_action_ids?: string[];
  collaborators_count?: number;
  has_collaborators?: boolean;
  products_count?: number;
  top_providers?: Array<{ id: string; name: string; products_count: number }>;
  has_more_providers?: boolean;
  total_providers_count?: number;
  translates?: Array<{ key: string; es: string; en: string }>;
}
