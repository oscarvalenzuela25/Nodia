import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { UserRole } from '../../user/entities/user-role.entity.js';
import { RoleAction } from './role-action.entity.js';
import type { Action } from '../../action/entities/action.entity.js';

@Entity({
  name: 'roles',
})
export class Role {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', unique: true })
  key: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  role_users: Relation<UserRole>[];

  @OneToMany(() => RoleAction, (roleAction) => roleAction.role)
  role_actions: Relation<RoleAction>[];

  actions?: Relation<Action>[];
}
