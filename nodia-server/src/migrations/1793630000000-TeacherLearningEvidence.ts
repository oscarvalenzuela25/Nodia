import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherLearningEvidence1793630000000 implements MigrationInterface {
  name = 'TeacherLearningEvidence1793630000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE teacher_generation_jobs DROP CONSTRAINT teacher_generation_jobs_purpose_check, ADD CONSTRAINT teacher_generation_jobs_purpose_check CHECK(purpose IN ('setup_reply','plan_outline','plan_adjustment','learning_packet','assessment_only','written_feedback','contextual_reply'));
      ALTER TABLE teacher_responses ADD COLUMN self_explanation text CHECK(length(self_explanation)<=2000), ADD COLUMN confidence integer CHECK(confidence BETWEEN 0 AND 100), ADD CONSTRAINT teacher_response_session_identity UNIQUE(session_id,id);
      ALTER TABLE teacher_objectives ADD CONSTRAINT teacher_objective_session_identity UNIQUE(session_id,plan_revision_id,id);
      CREATE TABLE teacher_learning_blueprints (
        id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES teacher_sessions(id) ON DELETE RESTRICT,
        revision integer NOT NULL CHECK(revision>0),title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
        dimensions jsonb NOT NULL,items jsonb NOT NULL,reviewed boolean NOT NULL DEFAULT false,
        reviewed_by_actor_id bigint REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        UNIQUE(session_id,id),UNIQUE(session_id,revision),CHECK(NOT reviewed OR reviewed_by_actor_id IS NOT NULL));
      CREATE TABLE teacher_learning_mappings (
        session_id uuid NOT NULL,blueprint_id uuid NOT NULL,dimension_id uuid NOT NULL,
        plan_revision_id uuid NOT NULL,objective_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        PRIMARY KEY(blueprint_id,dimension_id,plan_revision_id,objective_id),
        FOREIGN KEY(session_id,blueprint_id) REFERENCES teacher_learning_blueprints(session_id,id) ON DELETE RESTRICT,
        FOREIGN KEY(session_id,plan_revision_id) REFERENCES teacher_plan_revisions(session_id,id) ON DELETE RESTRICT);
      ALTER TABLE teacher_assessments ADD COLUMN diagnostic_blueprint_id uuid,ALTER COLUMN generation_job_id DROP NOT NULL,
        ADD CONSTRAINT teacher_assessment_blueprint FOREIGN KEY(session_id,diagnostic_blueprint_id) REFERENCES teacher_learning_blueprints(session_id,id) ON DELETE RESTRICT,
        ADD CONSTRAINT teacher_assessment_origin CHECK(generation_job_id IS NOT NULL OR (scope='diagnostic' AND diagnostic_blueprint_id IS NOT NULL));
      CREATE TABLE teacher_learning_evidence (
        id uuid PRIMARY KEY,session_id uuid NOT NULL, response_id uuid NOT NULL,attempt_id uuid NOT NULL,
        objective_id uuid NOT NULL,description text NOT NULL,plan_revision_id uuid,
        answer_state text NOT NULL CHECK(answer_state IN ('pending','graded','needs_review')),
        earned_points integer,max_points integer NOT NULL CHECK(max_points>0),assisted boolean NOT NULL,
        self_explanation text,confidence integer CHECK(confidence BETWEEN 0 AND 100),observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        UNIQUE(response_id,objective_id,answer_state),
        FOREIGN KEY(session_id,response_id) REFERENCES teacher_responses(session_id,id) ON DELETE RESTRICT,
        FOREIGN KEY(session_id,attempt_id) REFERENCES teacher_attempts(session_id,id) ON DELETE RESTRICT,
        CHECK(earned_points IS NULL OR earned_points BETWEEN 0 AND max_points));
      CREATE INDEX teacher_learning_evidence_scope ON teacher_learning_evidence(session_id,plan_revision_id,objective_id,observed_at DESC,id DESC);
      CREATE TABLE teacher_learning_interactions (
        id uuid PRIMARY KEY,session_id uuid NOT NULL REFERENCES teacher_sessions(id) ON DELETE RESTRICT,
        content_version_id uuid NOT NULL,block_id text NOT NULL,kind text NOT NULL CHECK(kind IN ('prediction','check')),
        text text NOT NULL CHECK(length(text) BETWEEN 1 AND 2000),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        FOREIGN KEY(session_id,content_version_id) REFERENCES teacher_content_versions(session_id,id) ON DELETE RESTRICT);
      CREATE INDEX teacher_learning_interactions_scope ON teacher_learning_interactions(session_id,content_version_id,created_at DESC);
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DO $$ BEGIN IF EXISTS(SELECT 1 FROM teacher_generation_jobs WHERE purpose='contextual_reply') OR EXISTS(SELECT 1 FROM teacher_learning_blueprints) OR EXISTS(SELECT 1 FROM teacher_learning_evidence) OR EXISTS(SELECT 1 FROM teacher_learning_interactions) OR EXISTS(SELECT 1 FROM teacher_responses WHERE self_explanation IS NOT NULL OR confidence IS NOT NULL) THEN RAISE EXCEPTION 'teacher_learning_data_present'; END IF; END $$;`,
    );
    await q.query(`ALTER TABLE teacher_generation_jobs DROP CONSTRAINT teacher_generation_jobs_purpose_check, ADD CONSTRAINT teacher_generation_jobs_purpose_check CHECK(purpose IN ('setup_reply','plan_outline','plan_adjustment','learning_packet','assessment_only','written_feedback'));
      DROP TABLE teacher_learning_interactions,teacher_learning_evidence,teacher_learning_mappings;
      ALTER TABLE teacher_assessments DROP CONSTRAINT teacher_assessment_origin,DROP CONSTRAINT teacher_assessment_blueprint,DROP COLUMN diagnostic_blueprint_id,ALTER COLUMN generation_job_id SET NOT NULL;
      DROP TABLE teacher_learning_blueprints;
      ALTER TABLE teacher_responses DROP CONSTRAINT teacher_response_session_identity,DROP COLUMN self_explanation,DROP COLUMN confidence;
      ALTER TABLE teacher_objectives DROP CONSTRAINT teacher_objective_session_identity;`);
  }
}
