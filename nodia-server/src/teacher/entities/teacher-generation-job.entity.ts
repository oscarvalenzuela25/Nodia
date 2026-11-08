import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  TeacherPurpose,
  TeacherSelection,
} from '../types/teacher.types.js';
@Entity('teacher_generation_jobs')
export class TeacherGenerationJobEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column('uuid') session_id!: string;
  @Column('bigint') actor_id!: string;
  @Column('uuid', { nullable: true }) auth_session_public_id!: string | null;
  @Column('text') purpose!: TeacherPurpose;
  @Column('uuid', { nullable: true }) plan_revision_id!: string | null;
  @Column('uuid', { nullable: true }) section_id!: string | null;
  @Column('uuid', { nullable: true }) unit_id!: string | null;
  @Column('uuid', { nullable: true }) attempt_id!: string | null;
  @Column('uuid', { nullable: true }) replaces_job_id!: string | null;
  @Column('text') state!: string;
  @Column('boolean') blocks_duplicate!: boolean;
  @Column('char', { length: 64, select: false }) semantic_key!: string;
  @Column('jsonb', { select: false }) input_snapshot!: Record<string, unknown>;
  @Column('text', { select: false }) prompt_snapshot!: string;
  @Column('text', { select: false }) template_ref!: string;
  @Column('text', { select: false }) template_version!: string;
  @Column('char', { length: 64, select: false }) template_hash!: string;
  @Column('char', { length: 64, select: false }) input_hash!: string;
  @Column('jsonb', { select: false }) selection_snapshot!: TeacherSelection;
  @Column('text', { select: false }) configuration_generation!: string;
  @Column('text', { select: false, nullable: true }) session_generation!:
    string | null;
  @Column('integer') dispatch_limit!: number;
  @Column('integer') dispatches_used!: number;
  @Column('timestamptz') deadline_at!: Date;
  @Column('timestamptz') available_at!: Date;
  @Column('uuid', { nullable: true, select: false }) lease_owner!:
    string | null;
  @Column('timestamptz', { nullable: true, select: false })
  lease_until!: Date | null;
  @Column('bigint') fence!: string;
  @Column('text', { nullable: true }) error_code!: string | null;
  @Column('jsonb', { nullable: true }) result_ref!: Record<
    string,
    unknown
  > | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
