import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Module as ModuleEntity } from '../../module/entities/module.entity.js';

@Entity({
  name: 'module_groups',
})
@Check('ck_module_groups_sort_order_nonnegative', '"sort_order" >= 0')
@Unique('uq_module_groups_sort_order', ['sort_order'], {
  deferrable: 'INITIALLY IMMEDIATE',
})
export class ModuleGroup {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', unique: true })
  key: string;

  @Column({ type: 'integer' })
  sort_order: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  icon?: string | null;

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
