import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { TeacherSelection, TeacherState } from '../types/teacher.types.js';
/** Explicit ORM projection; composite domain FKs and constraints live in the migration. */
@Entity('teacher_sessions')
export class TeacherSession {
  @PrimaryColumn('uuid') id!: string;
  @Column('bigint') owner_user_id!: string;
  @Column('varchar', { length: 120, nullable: true }) title!: string | null;
  @Column('varchar', { length: 240 }) topic!: string;
  @Column('varchar', { length: 2000 }) objective!: string;
  @Column('text', { nullable: true }) declared_base!: string | null;
  @Column('text', { nullable: true }) context!: string | null;
  @Column('varchar', { length: 35 }) explanation_language!: string;
  @Column('text') requested_organization!:
    'teacher_suggests' | 'days' | 'topics';
  @Column('integer', { nullable: true }) requested_day_count!: number | null;
  @Column('jsonb', { nullable: true }) selection!: TeacherSelection | null;
  @Column('text', { default: '' }) setup_draft_text!: string;
  @Column('integer', { default: 0 }) setup_draft_revision!: number;
  @Column('text') state!: TeacherState;
  @Column('text', { nullable: true }) resume_state!: TeacherState | null;
  @Column('text', { nullable: true }) archived_state!: TeacherState | null;
  @Column('integer') revision!: number;
  @Column('uuid', { nullable: true }) current_plan_revision_id!: string | null;
  @Column('integer') dispatch_limit!: number;
  @Column('integer') dispatches_used!: number;
  @Column('bigint') created_by_actor_id!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
