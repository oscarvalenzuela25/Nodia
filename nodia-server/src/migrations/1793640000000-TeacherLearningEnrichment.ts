import type { MigrationInterface, QueryRunner } from 'typeorm';
export class TeacherLearningEnrichment1793640000000 implements MigrationInterface {
  name = 'TeacherLearningEnrichment1793640000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE teacher_enrichment_states(session_id uuid PRIMARY KEY REFERENCES teacher_sessions(id) ON DELETE RESTRICT,revision integer NOT NULL DEFAULT 0 CHECK(revision>=0));
      CREATE TABLE teacher_enrichment_records(
        id uuid PRIMARY KEY,session_id uuid NOT NULL REFERENCES teacher_sessions(id) ON DELETE RESTRICT,
        kind text NOT NULL CHECK(kind IN ('card','thread','source','activity','concept','equivalence','visual')),
        revision integer NOT NULL DEFAULT 1 CHECK(revision>0),data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=200000),
        created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(session_id,id));
      CREATE INDEX teacher_enrichment_records_list ON teacher_enrichment_records(session_id,kind,created_at,id);
      CREATE TABLE teacher_enrichment_events(
        id uuid PRIMARY KEY,session_id uuid NOT NULL,record_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('rating','message','response','equivalence')),
        data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<=20000),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
        FOREIGN KEY(session_id,record_id) REFERENCES teacher_enrichment_records(session_id,id) ON DELETE RESTRICT);
      CREATE INDEX teacher_enrichment_events_list ON teacher_enrichment_events(session_id,record_id,created_at,id);
      CREATE UNIQUE INDEX teacher_enrichment_assistant_job ON teacher_enrichment_events((data->>'job_id')) WHERE kind='message' AND data->>'role'='assistant';
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DO $$ BEGIN IF EXISTS(SELECT 1 FROM teacher_enrichment_records) OR EXISTS(SELECT 1 FROM teacher_enrichment_events) THEN RAISE EXCEPTION 'teacher_enrichment_rollback_has_data'; END IF; END $$; DROP TABLE teacher_enrichment_events,teacher_enrichment_records,teacher_enrichment_states;`,
    );
  }
}
