import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { PrivateKey } from '../types/teacher.types.js';
/** Keys are excluded by default even if another caller accidentally loads ORM rows. */
@Entity('teacher_assessment_keys')
export class TeacherAssessmentKey {
  @PrimaryColumn('uuid') item_id!: string;
  @Column('uuid') session_id!: string;
  @Column('uuid') assessment_id!: string;
  @Column('jsonb', { select: false }) private_key!: PrivateKey;
  @Column('text', { select: false }) expected_explanation!: string;
  @Column('text', { select: false, nullable: true }) hint!: string | null;
  @Column('char', { length: 64, select: false }) key_hash!: string;
}
