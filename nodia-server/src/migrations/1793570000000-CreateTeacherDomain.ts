import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive Teacher domain; rollback refuses to erase any admitted session. */
export class CreateTeacherDomain1793570000000 implements MigrationInterface {
  name = 'CreateTeacherDomain1793570000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
 CREATE TABLE teacher_sessions (
 id uuid PRIMARY KEY,owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 title varchar(120),topic varchar(240) NOT NULL,objective varchar(2000) NOT NULL,declared_base text,context text,
 explanation_language varchar(35) NOT NULL,requested_organization text NOT NULL DEFAULT 'teacher_suggests' CHECK(requested_organization IN ('teacher_suggests','days','topics')),
 requested_day_count integer CHECK(requested_day_count BETWEEN 1 AND 365),selection jsonb,
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','active','paused','completed','archived')),resume_state text,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),current_plan_revision_id uuid,
 dispatch_limit integer NOT NULL DEFAULT 200 CHECK(dispatch_limit=200),dispatches_used integer NOT NULL DEFAULT 0 CHECK(dispatches_used BETWEEN 0 AND dispatch_limit),
 created_by_actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(length(btrim(topic))>0 AND length(btrim(objective))>0),CHECK(context IS NULL OR length(context)<=4000),CHECK(declared_base IS NULL OR length(declared_base)<=4000),
 CHECK(requested_organization<>'topics' OR requested_day_count IS NULL),CHECK(resume_state IS NULL OR resume_state IN ('draft','active','completed','paused')));
 CREATE INDEX teacher_sessions_owner_list ON teacher_sessions(owner_user_id,state,updated_at DESC,id DESC);
 CREATE TABLE teacher_plan_revisions (
 id uuid PRIMARY KEY,session_id uuid NOT NULL REFERENCES teacher_sessions(id) ON DELETE RESTRICT,revision_no integer NOT NULL CHECK(revision_no>0),base_revision_id uuid,
 state text NOT NULL CHECK(state IN ('draft','candidate','accepted','superseded','discarded')),origin text NOT NULL CHECK(origin IN ('manual','ai')),
 outline jsonb NOT NULL,private_guide jsonb NOT NULL,assessment_policy jsonb NOT NULL,content_hash char(64) NOT NULL CHECK(content_hash~'^[0-9a-f]{64}$'),base_hash char(64),generation_job_id uuid,
 created_by_actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(session_id,id),UNIQUE(session_id,revision_no),
 FOREIGN KEY(session_id,base_revision_id) REFERENCES teacher_plan_revisions(session_id,id) ON DELETE RESTRICT);
 CREATE UNIQUE INDEX teacher_one_accepted_plan ON teacher_plan_revisions(session_id) WHERE state='accepted';
 ALTER TABLE teacher_sessions ADD CONSTRAINT teacher_session_current_plan FOREIGN KEY(id,current_plan_revision_id) REFERENCES teacher_plan_revisions(session_id,id) DEFERRABLE INITIALLY DEFERRED;
 CREATE TABLE teacher_sections (
 session_id uuid NOT NULL,plan_revision_id uuid NOT NULL,id uuid NOT NULL,title varchar(160) NOT NULL,ordinal integer NOT NULL CHECK(ordinal>0),required boolean NOT NULL DEFAULT true,semantic_hash char(64) NOT NULL,
 PRIMARY KEY(plan_revision_id,id),UNIQUE(session_id,plan_revision_id,id),UNIQUE(plan_revision_id,ordinal),FOREIGN KEY(session_id,plan_revision_id) REFERENCES teacher_plan_revisions(session_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_objectives (
 session_id uuid NOT NULL,plan_revision_id uuid NOT NULL,section_id uuid NOT NULL,id uuid NOT NULL,ordinal integer NOT NULL CHECK(ordinal>0),description text NOT NULL,
 PRIMARY KEY(plan_revision_id,id),UNIQUE(session_id,plan_revision_id,section_id,id),UNIQUE(plan_revision_id,section_id,ordinal),FOREIGN KEY(session_id,plan_revision_id,section_id) REFERENCES teacher_sections(session_id,plan_revision_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_units (
 session_id uuid NOT NULL,plan_revision_id uuid NOT NULL,section_id uuid NOT NULL,id uuid NOT NULL,title varchar(160) NOT NULL,ordinal integer NOT NULL CHECK(ordinal>0),day_start integer,day_end integer,semantic_hash char(64) NOT NULL,
 PRIMARY KEY(plan_revision_id,id),UNIQUE(session_id,plan_revision_id,id),UNIQUE(session_id,plan_revision_id,section_id,id),UNIQUE(plan_revision_id,section_id,ordinal),
 CHECK((day_start IS NULL AND day_end IS NULL) OR (day_start BETWEEN 1 AND 365 AND day_end BETWEEN day_start AND 365)),
 FOREIGN KEY(session_id,plan_revision_id,section_id) REFERENCES teacher_sections(session_id,plan_revision_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_unit_objectives (
 session_id uuid NOT NULL,plan_revision_id uuid NOT NULL,section_id uuid NOT NULL,unit_id uuid NOT NULL,objective_id uuid NOT NULL,PRIMARY KEY(plan_revision_id,unit_id,objective_id),
 FOREIGN KEY(session_id,plan_revision_id,section_id,unit_id) REFERENCES teacher_units(session_id,plan_revision_id,section_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,section_id,objective_id) REFERENCES teacher_objectives(session_id,plan_revision_id,section_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_section_prerequisites (
 session_id uuid NOT NULL,plan_revision_id uuid NOT NULL,section_id uuid NOT NULL,required_section_id uuid NOT NULL,PRIMARY KEY(plan_revision_id,section_id,required_section_id),CHECK(section_id<>required_section_id),
 FOREIGN KEY(session_id,plan_revision_id,section_id) REFERENCES teacher_sections(session_id,plan_revision_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,required_section_id) REFERENCES teacher_sections(session_id,plan_revision_id,id) ON DELETE RESTRICT);
 CREATE INDEX teacher_prerequisite_inverse ON teacher_section_prerequisites(plan_revision_id,required_section_id);
 CREATE TABLE teacher_generation_jobs (
 id uuid PRIMARY KEY,session_id uuid NOT NULL REFERENCES teacher_sessions(id) ON DELETE RESTRICT,actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 auth_session_public_id uuid REFERENCES auth_sessions(public_id) ON DELETE SET NULL,purpose text NOT NULL CHECK(purpose IN ('setup_reply','plan_outline','plan_adjustment','learning_packet','assessment_only','written_feedback')),
 plan_revision_id uuid,unit_id uuid,section_id uuid,attempt_id uuid,replaces_job_id uuid,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','blocked_paused','running','ready','failed_known','unknown','cancelled_before_dispatch')),blocks_duplicate boolean NOT NULL DEFAULT true,
 semantic_key char(64) NOT NULL,input_snapshot jsonb NOT NULL,prompt_snapshot text NOT NULL,template_ref text NOT NULL,template_version text NOT NULL,template_hash char(64) NOT NULL,input_hash char(64) NOT NULL,
 selection_snapshot jsonb NOT NULL,configuration_generation text NOT NULL,session_generation text,dispatch_limit integer NOT NULL DEFAULT 1 CHECK(dispatch_limit=1),dispatches_used integer NOT NULL DEFAULT 0 CHECK(dispatches_used BETWEEN 0 AND 1),
 deadline_at timestamptz NOT NULL,available_at timestamptz NOT NULL DEFAULT clock_timestamp(),lease_owner uuid,lease_until timestamptz,fence bigint NOT NULL DEFAULT 0 CHECK(fence>=0),error_code text,result_ref jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(session_id,id),
 FOREIGN KEY(session_id,plan_revision_id) REFERENCES teacher_plan_revisions(session_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,unit_id) REFERENCES teacher_units(session_id,plan_revision_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,section_id) REFERENCES teacher_sections(session_id,plan_revision_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,replaces_job_id) REFERENCES teacher_generation_jobs(session_id,id) ON DELETE RESTRICT,
 CHECK(octet_length(prompt_snapshot)<=131072));
 CREATE UNIQUE INDEX teacher_job_semantic_active ON teacher_generation_jobs(session_id,semantic_key) WHERE blocks_duplicate;
 CREATE INDEX teacher_job_queue ON teacher_generation_jobs(available_at,id) WHERE state='queued';
 CREATE INDEX teacher_job_lease ON teacher_generation_jobs(lease_until,id) WHERE state='running';
 CREATE INDEX teacher_job_actor ON teacher_generation_jobs(actor_id,state);
 CREATE TABLE teacher_generation_attempts (
 id uuid PRIMARY KEY,session_id uuid NOT NULL,job_id uuid NOT NULL,attempt_no integer NOT NULL CHECK(attempt_no>0),worker_id uuid NOT NULL,fence bigint NOT NULL CHECK(fence>0),
 phase text NOT NULL CHECK(phase IN ('claimed','dispatch_armed','transport_open','terminal')),started_at timestamptz NOT NULL DEFAULT clock_timestamp(),ended_at timestamptz,
 UNIQUE(job_id,attempt_no),UNIQUE(job_id,fence),UNIQUE(session_id,job_id,id),FOREIGN KEY(session_id,job_id) REFERENCES teacher_generation_jobs(session_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_setup_messages (
 id uuid PRIMARY KEY,session_id uuid NOT NULL REFERENCES teacher_sessions(id) ON DELETE RESTRICT,seq bigint NOT NULL CHECK(seq>0),role text NOT NULL CHECK(role IN ('user','assistant')),
 actor_id bigint REFERENCES users(id) ON DELETE RESTRICT,text text NOT NULL CHECK(length(text) BETWEEN 1 AND 4000 AND octet_length(text)<=8192),generation_job_id uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(session_id,seq),UNIQUE(generation_job_id),CHECK((role='user' AND actor_id IS NOT NULL) OR (role='assistant' AND actor_id IS NULL)),FOREIGN KEY(session_id,generation_job_id) REFERENCES teacher_generation_jobs(session_id,id) ON DELETE RESTRICT);
 ALTER TABLE teacher_plan_revisions ADD CONSTRAINT teacher_plan_generation_fk FOREIGN KEY(session_id,generation_job_id) REFERENCES teacher_generation_jobs(session_id,id) ON DELETE RESTRICT;
 CREATE TABLE teacher_content_versions (
 id uuid PRIMARY KEY,session_id uuid NOT NULL,plan_revision_id uuid NOT NULL,unit_id uuid NOT NULL,version_no integer NOT NULL CHECK(version_no>0),generation_job_id uuid NOT NULL UNIQUE,
 context_hash char(64) NOT NULL,public_blocks jsonb NOT NULL,content_hash char(64) NOT NULL,publication_state text NOT NULL CHECK(publication_state IN ('current','superseded')),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(session_id,id),UNIQUE(session_id,plan_revision_id,unit_id,id),UNIQUE(plan_revision_id,unit_id,version_no),
 FOREIGN KEY(session_id,plan_revision_id,unit_id) REFERENCES teacher_units(session_id,plan_revision_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,generation_job_id) REFERENCES teacher_generation_jobs(session_id,id) ON DELETE RESTRICT);
 CREATE UNIQUE INDEX teacher_content_current ON teacher_content_versions(plan_revision_id,unit_id) WHERE publication_state='current';
 CREATE TABLE teacher_assessments (
 id uuid PRIMARY KEY,session_id uuid NOT NULL REFERENCES teacher_sessions(id) ON DELETE RESTRICT,plan_revision_id uuid,section_id uuid,unit_id uuid,content_version_id uuid,
 scope text NOT NULL CHECK(scope IN ('unit_practice','section_final','diagnostic')),version_no integer NOT NULL CHECK(version_no>0),policy_version text NOT NULL,policy_snapshot jsonb NOT NULL,coverage jsonb NOT NULL,coverage_hash char(64) NOT NULL,generation_job_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('ready','withdrawn')),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(session_id,id),UNIQUE(session_id,id,scope),UNIQUE(session_id,id,plan_revision_id,section_id),UNIQUE(session_id,id,plan_revision_id,section_id,unit_id),
 CHECK((scope='unit_practice' AND plan_revision_id IS NOT NULL AND section_id IS NOT NULL AND unit_id IS NOT NULL AND content_version_id IS NOT NULL) OR (scope='section_final' AND plan_revision_id IS NOT NULL AND section_id IS NOT NULL AND unit_id IS NULL AND content_version_id IS NULL) OR (scope='diagnostic' AND section_id IS NULL AND unit_id IS NULL AND content_version_id IS NULL)),
 FOREIGN KEY(session_id,plan_revision_id,section_id) REFERENCES teacher_sections(session_id,plan_revision_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,section_id,unit_id) REFERENCES teacher_units(session_id,plan_revision_id,section_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,unit_id,content_version_id) REFERENCES teacher_content_versions(session_id,plan_revision_id,unit_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,generation_job_id) REFERENCES teacher_generation_jobs(session_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_assessment_items (
 id uuid PRIMARY KEY,session_id uuid NOT NULL,assessment_id uuid NOT NULL,ordinal integer NOT NULL CHECK(ordinal>0),kind text NOT NULL CHECK(kind IN ('single_choice','completion','short_text')),objective_ids uuid[] NOT NULL,
 public_question jsonb NOT NULL,max_points integer NOT NULL CHECK((kind IN ('single_choice','completion') AND max_points=2) OR (kind='short_text' AND max_points=6)),item_fingerprint char(64) NOT NULL,variant_group char(64) NOT NULL,
 UNIQUE(session_id,assessment_id,id),UNIQUE(assessment_id,ordinal),CHECK(cardinality(objective_ids)=1),FOREIGN KEY(session_id,assessment_id) REFERENCES teacher_assessments(session_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_assessment_keys (
 item_id uuid PRIMARY KEY,session_id uuid NOT NULL,assessment_id uuid NOT NULL,private_key jsonb NOT NULL,expected_explanation text NOT NULL CHECK(length(btrim(expected_explanation))>0),hint text,key_hash char(64) NOT NULL,
 FOREIGN KEY(session_id,assessment_id,item_id) REFERENCES teacher_assessment_items(session_id,assessment_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_attempts (
 id uuid PRIMARY KEY,session_id uuid NOT NULL,assessment_id uuid NOT NULL,scope text NOT NULL CHECK(scope IN ('unit_practice','section_final','diagnostic')),plan_revision_id uuid,section_id uuid,unit_id uuid,
 attempt_no integer NOT NULL CHECK(attempt_no>0),entry_route text NOT NULL CHECK(entry_route IN ('direct','after_study','practice','diagnostic')),state text NOT NULL DEFAULT 'in_progress' CHECK(state IN ('in_progress','submitted','grading_pending','graded')),
 is_active boolean NOT NULL DEFAULT true,closed_at timestamptz,closure_reason text,result text CHECK(result IN ('pending','passed','not_passed','not_independent')),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 denominator_points integer NOT NULL CHECK(denominator_points>0),earned_points integer CHECK(earned_points BETWEEN 0 AND denominator_points),threshold_percent integer,assisted boolean NOT NULL DEFAULT false,policy_snapshot jsonb NOT NULL,policy_hash char(64) NOT NULL,
 submitted_at timestamptz,graded_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(session_id,id),UNIQUE(session_id,id,assessment_id),UNIQUE(session_id,assessment_id,attempt_no),
 CHECK((scope='section_final' AND result IS NOT NULL AND threshold_percent=90) OR (scope<>'section_final' AND result IS NULL AND threshold_percent IS NULL)),
 CHECK(state<>'graded' OR (NOT is_active AND closed_at IS NOT NULL AND earned_points IS NOT NULL)),
 CHECK((scope='unit_practice' AND plan_revision_id IS NOT NULL AND section_id IS NOT NULL AND unit_id IS NOT NULL) OR (scope='section_final' AND plan_revision_id IS NOT NULL AND section_id IS NOT NULL AND unit_id IS NULL) OR (scope='diagnostic' AND section_id IS NULL AND unit_id IS NULL)),
 FOREIGN KEY(session_id,assessment_id,scope) REFERENCES teacher_assessments(session_id,id,scope) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,assessment_id,plan_revision_id,section_id) REFERENCES teacher_assessments(session_id,id,plan_revision_id,section_id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,assessment_id,plan_revision_id,section_id,unit_id) REFERENCES teacher_assessments(session_id,id,plan_revision_id,section_id,unit_id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,section_id) REFERENCES teacher_sections(session_id,plan_revision_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,section_id,unit_id) REFERENCES teacher_units(session_id,plan_revision_id,section_id,id) ON DELETE RESTRICT);
 CREATE UNIQUE INDEX teacher_active_practice ON teacher_attempts(session_id,plan_revision_id,unit_id) WHERE is_active AND scope='unit_practice';
 CREATE UNIQUE INDEX teacher_active_final ON teacher_attempts(session_id,plan_revision_id,section_id) WHERE is_active AND scope='section_final';
 CREATE UNIQUE INDEX teacher_active_diagnostic ON teacher_attempts(session_id) WHERE is_active AND scope='diagnostic';
 CREATE UNIQUE INDEX teacher_number_practice ON teacher_attempts(session_id,plan_revision_id,unit_id,attempt_no) WHERE scope='unit_practice';
 CREATE UNIQUE INDEX teacher_number_final ON teacher_attempts(session_id,plan_revision_id,section_id,attempt_no) WHERE scope='section_final';
 CREATE UNIQUE INDEX teacher_number_diagnostic ON teacher_attempts(session_id,attempt_no) WHERE scope='diagnostic';
 ALTER TABLE teacher_generation_jobs ADD CONSTRAINT teacher_job_attempt_fk FOREIGN KEY(session_id,attempt_id) REFERENCES teacher_attempts(session_id,id) ON DELETE RESTRICT;
 CREATE TABLE teacher_responses (
 id uuid PRIMARY KEY,session_id uuid NOT NULL,attempt_id uuid NOT NULL,assessment_id uuid NOT NULL,item_id uuid NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),draft_answer jsonb,frozen_answer jsonb,submitted_at timestamptz,
 grade_state text NOT NULL DEFAULT 'unsubmitted' CHECK(grade_state IN ('unsubmitted','pending','graded','needs_review')),earned_points integer CHECK(earned_points BETWEEN 0 AND 6),feedback jsonb,explanation_state text NOT NULL DEFAULT 'pending' CHECK(explanation_state IN ('ready','pending')),assistance jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(attempt_id,item_id),
 FOREIGN KEY(session_id,attempt_id,assessment_id) REFERENCES teacher_attempts(session_id,id,assessment_id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,assessment_id,item_id) REFERENCES teacher_assessment_items(session_id,assessment_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_cursors (
 session_id uuid PRIMARY KEY REFERENCES teacher_sessions(id) ON DELETE RESTRICT,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),plan_revision_id uuid,section_id uuid,unit_id uuid,content_version_id uuid,attempt_id uuid,item_id uuid,assessment_id uuid,
 phase text NOT NULL DEFAULT 'setup' CHECK(phase IN ('setup','theory','practice','final','review')),block_id text,updated_by_actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(session_id,plan_revision_id) REFERENCES teacher_plan_revisions(session_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,section_id) REFERENCES teacher_sections(session_id,plan_revision_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,unit_id) REFERENCES teacher_units(session_id,plan_revision_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,plan_revision_id,unit_id,content_version_id) REFERENCES teacher_content_versions(session_id,plan_revision_id,unit_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,attempt_id) REFERENCES teacher_attempts(session_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,attempt_id,assessment_id) REFERENCES teacher_attempts(session_id,id,assessment_id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,assessment_id,item_id) REFERENCES teacher_assessment_items(session_id,assessment_id,id) ON DELETE RESTRICT,
 CHECK(item_id IS NULL OR (assessment_id IS NOT NULL AND attempt_id IS NOT NULL)));
 CREATE TABLE teacher_unit_progress (
 session_id uuid NOT NULL,plan_revision_id uuid NOT NULL,unit_id uuid NOT NULL,content_version_id uuid NOT NULL,revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 state text NOT NULL CHECK(state IN ('not_started','in_progress','completed')),visited_block_ids jsonb NOT NULL DEFAULT '[]',completed_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(plan_revision_id,unit_id,content_version_id),FOREIGN KEY(session_id,plan_revision_id,unit_id,content_version_id) REFERENCES teacher_content_versions(session_id,plan_revision_id,unit_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_section_verifications (
 id uuid PRIMARY KEY,session_id uuid NOT NULL,plan_revision_id uuid NOT NULL,section_id uuid NOT NULL,semantic_hash char(64) NOT NULL,source_attempt_id uuid NOT NULL,source_verification_id uuid,verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(session_id,id),UNIQUE(session_id,plan_revision_id,section_id),FOREIGN KEY(session_id,plan_revision_id,section_id) REFERENCES teacher_sections(session_id,plan_revision_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,source_attempt_id) REFERENCES teacher_attempts(session_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(session_id,source_verification_id) REFERENCES teacher_section_verifications(session_id,id) ON DELETE RESTRICT);
 CREATE TABLE teacher_requests (
 actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,request_key uuid NOT NULL,operation text NOT NULL,session_id uuid REFERENCES teacher_sessions(id) ON DELETE RESTRICT,
 payload_hash char(64) NOT NULL,http_status integer NOT NULL CHECK(http_status BETWEEN 200 AND 299),receipt jsonb NOT NULL,completed_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(actor_id,request_key));
 CREATE INDEX teacher_attempt_history ON teacher_attempts(session_id,created_at DESC,id);
 `);
  }
  async down(q: QueryRunner): Promise<void> {
    const [row]: { occupied: boolean }[] = await q.query(
      'SELECT EXISTS(SELECT 1 FROM teacher_sessions) AS occupied',
    );
    if (row?.occupied)
      throw new Error(
        'Teacher rollback refused: preserve admitted sessions/results and reconcile operations first',
      );
    await q.query(`ALTER TABLE teacher_sessions DROP CONSTRAINT teacher_session_current_plan;
 ALTER TABLE teacher_plan_revisions DROP CONSTRAINT teacher_plan_generation_fk;
 ALTER TABLE teacher_generation_jobs DROP CONSTRAINT teacher_job_attempt_fk;
 DROP TABLE teacher_requests,teacher_section_verifications,teacher_unit_progress,teacher_cursors,teacher_responses,teacher_attempts,teacher_assessment_keys,teacher_assessment_items,teacher_assessments,teacher_content_versions,teacher_setup_messages,teacher_generation_attempts,teacher_generation_jobs,teacher_section_prerequisites,teacher_unit_objectives,teacher_units,teacher_objectives,teacher_sections,teacher_plan_revisions,teacher_sessions;`);
  }
}
