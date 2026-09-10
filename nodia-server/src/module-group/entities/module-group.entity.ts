import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Module as ModuleEntity } from '../../module/entities/module.entity.js';

@Entity({
  name: 'module_groups',
})
export class ModuleGroup {
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

  @OneToMany(() => ModuleEntity, (module) => module.module_group)
  modules: Relation<ModuleEntity>[];

  translates?: Array<{ key: string; es: string; en: string }>;
}
