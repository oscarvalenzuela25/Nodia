import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../user/entities/user.entity.js';

@Entity('auth_sessions')
export class AuthSession {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Index('uq_auth_sessions_public_id', { unique: true })
  @Column({ type: 'uuid' })
  public_id!: string;

  @Index('idx_auth_sessions_user_id')
  @Column({ type: 'bigint' })
  user_id!: string;

  @Column({ type: 'text', nullable: true })
  image_url!: string | null;

  @Column({ type: 'varchar', length: 64, select: false })
  refresh_token_hash!: string;

  @Index('idx_auth_sessions_expires_at')
  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;
}
