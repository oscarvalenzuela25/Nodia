import type { MigrationInterface, QueryRunner } from 'typeorm';
export class TeacherPurposeQualification1793650000000 implements MigrationInterface {
  name = 'TeacherPurposeQualification1793650000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE teacher_purpose_qualifications(
      scope_hash char(64) PRIMARY KEY,policy_hash char(64) NOT NULL,transport_scope_hash char(64) NOT NULL,
      purpose text NOT NULL CHECK(purpose='contextual_reply'),
      selection_snapshot jsonb NOT NULL CHECK(jsonb_typeof(selection_snapshot)='object'),
      configuration_generation char(64) NOT NULL,session_generation text,
      operation_id uuid NOT NULL REFERENCES ai_generation_operations(id) ON DELETE RESTRICT,
      response_hash char(64) NOT NULL,evidence_hash char(64) NOT NULL,
      observed_at timestamptz NOT NULL DEFAULT clock_timestamp());`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DO $$ BEGIN IF EXISTS(SELECT 1 FROM teacher_purpose_qualifications) THEN
      RAISE EXCEPTION 'teacher_purpose_qualification_rollback_has_data'; END IF; END $$;
      DROP TABLE teacher_purpose_qualifications;`);
  }
}
