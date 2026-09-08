import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { UserModule as UserModuleEntity } from '../../user/entities/user-module.entity.js';

@Entity({
  name: 'modules',
})
@Index('idx_modules_group_by', ['group_by'])
export class Module {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', unique: true })
  key: string;

  @Column({ type: 'varchar' })
  group_by: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => UserModuleEntity, (userModule) => userModule.module)
  module_users: Relation<UserModuleEntity>[];

  translates?: Array<{ key: string; es: string; en: string }>;
}
