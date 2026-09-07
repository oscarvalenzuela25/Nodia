import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  type Relation,
} from 'typeorm';
import { UserRole } from './user-role.entity.js';
import type { Role } from '../../role/entities/role.entity.js';

@Entity({
  name: 'users',
})
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string; //  El driver de PostgreSQL en Node.js siempre devuelve los valores BIGINT como string.

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'text', unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  image_url?: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @OneToMany(() => UserRole, (userRole) => userRole.user)
  user_roles: Relation<UserRole>[];

  roles?: Relation<Role>[];
}
