import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive native text ownership. Never rewrites API qualifications or signed chat proofs. */
export class TeacherAgenticTextOwnership1793600000000 implements MigrationInterface {
  async up(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE ai_generation_operations
      ADD CONSTRAINT uq_generation_operation_owner UNIQUE(id,owner_kind),
      ADD COLUMN agentic_transport_descriptor jsonb,
      ADD COLUMN agentic_acknowledged_at timestamptz,
      ADD CONSTRAINT ck_teacher_agentic_descriptor CHECK(agentic_transport_descriptor IS NULL OR
        coalesce((owner_kind='teacher' AND selection_snapshot->>'mode'='agentic'
        AND jsonb_typeof(agentic_transport_descriptor)='object'
        AND octet_length(agentic_transport_descriptor::text)<=16384
        AND agentic_transport_descriptor->>'provider' IN ('openai','gemini')
        AND agentic_transport_descriptor->'reference'->>'operation_id'=id::text
        AND agentic_transport_descriptor->'reference'->>'session_id'=teacher_session_id::text
        AND agentic_transport_descriptor->'reference'->>'job_id'=teacher_job_id::text
        AND agentic_transport_descriptor->'reference'->>'attempt_id'=teacher_attempt_id::text
        AND agentic_transport_descriptor->'reference'->>'actor_id'=actor_id::text
        AND agentic_transport_descriptor->'reference'->>'connection_id'=connection_id::text
        AND agentic_transport_descriptor->'reference'->>'contract'='teacher-agentic-text/1'
        AND agentic_transport_descriptor->'reference'->>'resource_key'=resource_key
        AND agentic_transport_descriptor->'reference'->>'configuration_generation'=configuration_generation
        AND agentic_transport_descriptor->'reference'->>'session_generation'=session_generation
        AND agentic_transport_descriptor->'reference'->>'model_id'=selection_snapshot->>'model_id'
        AND (agentic_transport_descriptor->'reference' ? 'effort_id')
        AND (agentic_transport_descriptor->'reference'->>'effort_id' IS NOT DISTINCT FROM selection_snapshot->>'effort_id')
        AND agentic_transport_descriptor->'reference'->>'request_hash' ~ '^[0-9a-f]{64}$'),false))`);
    await r.query(`CREATE TABLE ai_generation_agentic_qualifications (
      scope_hash char(64) PRIMARY KEY CHECK(scope_hash ~ '^[0-9a-f]{64}$'),
      contract_version text NOT NULL CHECK(contract_version='teacher-agentic-text/1'),
      owner_kind text NOT NULL DEFAULT 'teacher' CHECK(owner_kind='teacher'),
      operation_id uuid NOT NULL,
      FOREIGN KEY(operation_id,owner_kind) REFERENCES ai_generation_operations(id,owner_kind) ON DELETE RESTRICT,
      provider_key text NOT NULL CHECK(provider_key IN ('openai','gemini')),
      selection_hash char(64) NOT NULL CHECK(selection_hash ~ '^[0-9a-f]{64}$'),
      selection_snapshot jsonb NOT NULL CHECK(jsonb_typeof(selection_snapshot)='object' AND octet_length(selection_snapshot::text)<=8192),
      configuration_generation char(64) NOT NULL CHECK(configuration_generation ~ '^[0-9a-f]{64}$'),
      observation_snapshot jsonb NOT NULL CHECK(jsonb_typeof(observation_snapshot)='object' AND octet_length(observation_snapshot::text)<=8192),
      response_hash char(64) NOT NULL CHECK(response_hash ~ '^[0-9a-f]{64}$'),
      evidence_hash char(64) NOT NULL CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
      observed_at timestamptz NOT NULL DEFAULT clock_timestamp())`);
    await r.query(`CREATE INDEX ix_teacher_agentic_qualification_selection
      ON ai_generation_agentic_qualifications(selection_hash,configuration_generation,observed_at DESC)`);
    await r.query(`CREATE INDEX ix_teacher_agentic_pending_ack ON ai_generation_operations(created_at)
      WHERE agentic_transport_descriptor IS NOT NULL AND agentic_acknowledged_at IS NULL`);
  }
  async down(r: QueryRunner): Promise<void> {
    const rows: {n:string}[] = await r.query(`SELECT ((SELECT count(*) FROM ai_generation_agentic_qualifications)
      +(SELECT count(*) FROM ai_generation_operations WHERE agentic_transport_descriptor IS NOT NULL))::text AS n`);
    if (rows[0]?.n !== '0') throw Error('teacher_agentic_rollback_requires_reconciliation');
    await r.query('DROP TABLE ai_generation_agentic_qualifications');
    await r.query('DROP INDEX ix_teacher_agentic_pending_ack');
    await r.query(`ALTER TABLE ai_generation_operations DROP CONSTRAINT ck_teacher_agentic_descriptor,
      DROP COLUMN agentic_transport_descriptor,DROP COLUMN agentic_acknowledged_at,DROP CONSTRAINT uq_generation_operation_owner`);
  }
}
