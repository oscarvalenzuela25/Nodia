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
import { RoleAction } from '../../role/entities/role-action.entity.js';
import { Module } from '../../module/entities/module.entity.js';

@Entity({
  name: 'actions',
})
export class Action {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint', nullable: true })
  module_id: string | null;

  @Column({ type: 'varchar', unique: true })
  key: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => RoleAction, (roleAction) => roleAction.action)
  action_roles: Relation<RoleAction>[];

  @ManyToOne(() => Module, (module) => module.actions)
  @JoinColumn({ name: 'module_id' })
  module: Relation<Module>;
}
