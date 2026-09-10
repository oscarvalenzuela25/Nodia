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
import { UserModule as UserModuleEntity } from '../../user/entities/user-module.entity.js';
import { ModuleGroup as ModuleGroupEntity } from '../../module-group/entities/module-group.entity.js';

@Entity({
  name: 'modules',
})
@Index('idx_modules_module_group_id', ['module_group_id'])
export class Module {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  module_group_id: string;

  @Column({ type: 'varchar', length: 255 })
  link: string;

  @Column({ type: 'varchar', unique: true })
  key: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => ModuleGroupEntity, (moduleGroup) => moduleGroup.modules)
  @JoinColumn({ name: 'module_group_id' })
  module_group?: Relation<ModuleGroupEntity>;

  @OneToMany(() => UserModuleEntity, (userModule) => userModule.module)
  module_users: Relation<UserModuleEntity>[];

  translates?: Array<{ key: string; es: string; en: string }>;
}
