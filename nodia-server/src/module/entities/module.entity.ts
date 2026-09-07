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
import { Action } from '../../action/entities/action.entity.js';

@Entity({
  name: 'modules',
})
export class Module {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', unique: true })
  key: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'bigint', nullable: true })
  parent_id: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => Action, (action) => action.module)
  actions: Relation<Action>[];

  @ManyToOne(() => Module, (module) => module.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Relation<Module> | null;

  @OneToMany(() => Module, (module) => module.parent)
  children: Relation<Module>[];

  parent_module?: Relation<Module> | null;
}
