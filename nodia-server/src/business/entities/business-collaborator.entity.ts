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
import { User } from '../../user/entities/user.entity.js';
import { Business } from './business.entity.js';

@Entity({
  name: 'business_collaborators',
})
@Index('uq_business_collaborator_user', ['business_id', 'user_id'], { unique: true })
export class BusinessCollaborator {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  position: string | null;

  @Column({ type: 'bigint' })
  user_id: string;

  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'bigint', array: true, default: '{}' })
  action_ids: string[];

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Business, (business) => business.collaborators, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'business_id' })
  business: Relation<Business>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;
}
