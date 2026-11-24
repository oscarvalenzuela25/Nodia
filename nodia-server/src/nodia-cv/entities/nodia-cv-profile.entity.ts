import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { NodiaCvProfileData } from '../types/nodia-cv-profile.types.js';

@Entity('nodia_cv_profiles')
export class NodiaCvProfileEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('bigint') owner_user_id!: string;
  @Column('integer', { default: 1 }) revision!: number;
  @Column('smallint', { default: 1 }) schema_version!: number;
  @Column('varchar', { length: 120 }) profile_name!: string;
  @Column('varchar', { length: 160 }) full_name!: string;
  @Column('varchar', { length: 160, nullable: true })
  professional_title!: string | null;
  @Column('jsonb') data!: NodiaCvProfileData;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
