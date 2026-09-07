import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Role } from './role.entity.js';
import { Action } from '../../action/entities/action.entity.js';

@Entity({
  name: 'role_actions',
})
export class RoleAction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  role_id: string;

  @Column({ type: 'bigint' })
  action_id: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Role, (role) => role.role_actions)
  @JoinColumn({ name: 'role_id' })
  role: Relation<Role>;

  @ManyToOne(() => Action, (action) => action.action_roles)
  @JoinColumn({ name: 'action_id' })
  action: Relation<Action>;
}
