import type { MigrationInterface, QueryRunner } from 'typeorm';

const teacherDescriptor = `(owner_kind='teacher' AND selection_snapshot->>'mode'='agentic'
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
  AND agentic_transport_descriptor->'reference'->>'request_hash' ~ '^[0-9a-f]{64}$')`;

const uuid = '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$';
const hash = '^[0-9a-f]{64}$';
const processIdentity = (identity: string) => `(
  jsonb_typeof(${identity})='object'
  AND (${identity}-ARRAY['pid','group','birth','boot'])='{}'::jsonb
  AND jsonb_typeof(${identity}->'pid')='number'
  AND jsonb_typeof(${identity}->'group')='number'
  AND ${identity}->>'pid' ~ '^[1-9][0-9]{0,9}$'
  AND ${identity}->>'group' ~ '^[1-9][0-9]{0,9}$'
  AND ${identity}->>'birth' ~ '^[0-9]{1,20}$'
  AND ${identity}->>'boot' ~ '${uuid}')`;

const cvDescriptor = `(owner_kind='cv' AND selection_snapshot->>'mode'='agentic'
  AND jsonb_typeof(agentic_transport_descriptor)='object'
  AND octet_length(agentic_transport_descriptor::text)<=4096
  AND agentic_transport_descriptor->>'contract'='cv-agentic-text/1'
  AND agentic_transport_descriptor->>'owner_kind'='cv'
  AND agentic_transport_descriptor->>'provider'='openai'
  AND agentic_transport_descriptor->>'mode'='agentic'
  AND agentic_transport_descriptor->>'generation_id'=cv_generation_id::text
  AND agentic_transport_descriptor->>'attempt_id' ~ '${uuid}'
  AND agentic_transport_descriptor->>'profile_id' ~ '${uuid}'
  AND agentic_transport_descriptor->>'profile_revision' ~ '^[1-9][0-9]{0,9}$'
  AND agentic_transport_descriptor->>'actor_id'=actor_id::text
  AND agentic_transport_descriptor->>'connection_id'=connection_id::text
  AND agentic_transport_descriptor->>'model_id'=selection_snapshot->>'model_id'
  AND (agentic_transport_descriptor ? 'effort_id')
  AND (agentic_transport_descriptor->>'effort_id' IS NOT DISTINCT FROM selection_snapshot->>'effort_id')
  AND agentic_transport_descriptor->>'resource_key'=resource_key
  AND resource_key ~ '^codex-profile:[0-9a-f]{64}$'
  AND agentic_transport_descriptor->>'configuration_generation'=configuration_generation
  AND configuration_generation ~ '${hash}'
  AND agentic_transport_descriptor->>'session_generation'=session_generation
  AND session_generation ~ '^[0-9a-f]{32}$'
  AND agentic_transport_descriptor->>'payload_hash' ~ '${hash}'
  AND agentic_transport_descriptor->>'policy_hash' ~ '${hash}'
  AND agentic_transport_descriptor->>'runtime_hash' ~ '${hash}'
  AND agentic_transport_descriptor->>'purpose_version'='cv_tailoring'
  AND agentic_transport_descriptor->>'prompt_version'='cv-tailoring/1'
  AND agentic_transport_descriptor->'schema_version'='1'::jsonb
  AND agentic_transport_descriptor->>'policy_version'='cv-agentic-text-policy/1')`;

export class AttachNodiaCvAgenticCustody1794041000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE ai_generation_operations
        ADD COLUMN cv_agentic_native jsonb,
        DROP CONSTRAINT ck_teacher_agentic_descriptor,
        ADD CONSTRAINT ck_generation_agentic_descriptor CHECK(
          agentic_transport_descriptor IS NULL OR coalesce(${teacherDescriptor} OR ${cvDescriptor},false)),
        ADD CONSTRAINT ck_cv_agentic_custody CHECK(cv_agentic_native IS NULL OR coalesce((
          owner_kind='cv' AND selection_snapshot->>'mode'='agentic'
          AND jsonb_typeof(cv_agentic_native)='object' AND octet_length(cv_agentic_native::text)<=4096
          AND (cv_agentic_native-ARRAY['owner','native','workspace'])='{}'::jsonb
          AND cv_agentic_native->>'workspace' ~ '^(teacher|cv)-work-[A-Za-z0-9]{6,64}$'
          AND ${processIdentity("(cv_agentic_native->'owner')")}
          AND (cv_agentic_native->'native'='null'::jsonb OR (
            ${processIdentity("(cv_agentic_native->'native')")}
            AND cv_agentic_native->'native'->>'pid'=cv_agentic_native->'native'->>'group'
            AND cv_agentic_native->'native'->>'boot'=cv_agentic_native->'owner'->>'boot'
            AND cv_agentic_native->'native'->>'pid'<>cv_agentic_native->'owner'->>'pid'
          ))),false)),
        ADD CONSTRAINT ck_cv_agentic_lifecycle CHECK(
          owner_kind<>'cv' OR selection_snapshot->>'mode'<>'agentic' OR coalesce((
            agentic_transport_descriptor IS NOT NULL
            AND selected_key_id IS NULL AND api_owner_identity IS NULL
            AND phase IN ('dispatch_armed','transport_open','closed')
            AND (phase<>'transport_open' OR started_exchanges=1)
            AND (started_exchanges=0 OR (phase<>'dispatch_armed'
                 AND jsonb_typeof(cv_agentic_native->'native')='object'))
            AND (acknowledged_at IS NULL)=(agentic_acknowledged_at IS NULL)
            AND (acknowledged_at IS NULL OR phase='closed')
            AND (
              (phase<>'closed' AND terminal_proof IS NULL AND remote_outcome IS NULL AND response_hash IS NULL)
              OR (phase='closed' AND terminal_proof IS NOT NULL
                AND jsonb_typeof(terminal_proof)='object'
                AND (terminal_proof-ARRAY['terminal_proof_id','observed_at','process_closed','remote_outcome','response_hash'])
                    =agentic_transport_descriptor
                AND terminal_proof->>'terminal_proof_id' ~ '${uuid}'
                AND terminal_proof->>'observed_at' IS NOT NULL
                AND terminal_proof->'process_closed'='true'::jsonb
                AND terminal_proof ? 'response_hash'
                AND (terminal_proof->>'response_hash' IS NOT DISTINCT FROM response_hash::text)
                AND (
                  (terminal_proof->>'remote_outcome'='not_dispatched' AND remote_outcome IS NULL AND response_hash IS NULL)
                  OR (started_exchanges=1 AND remote_outcome='unknown'
                      AND terminal_proof->>'remote_outcome'='unknown' AND response_hash IS NULL)
                  OR (started_exchanges=1 AND remote_outcome='completed'
                      AND terminal_proof->>'remote_outcome'='completed' AND response_hash ~ '${hash}')
                ))
            )),false));
      CREATE UNIQUE INDEX ux_cv_agentic_attempt ON ai_generation_operations((agentic_transport_descriptor->>'attempt_id'))
        WHERE owner_kind='cv' AND agentic_transport_descriptor IS NOT NULL;
      CREATE INDEX ix_cv_agentic_pending ON ai_generation_operations(updated_at,id)
        WHERE owner_kind='cv' AND acknowledged_at IS NULL AND agentic_transport_descriptor IS NOT NULL;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE ai_generation_operations IN ACCESS EXCLUSIVE MODE;
      DO $guard$ BEGIN
        IF EXISTS(SELECT 1 FROM ai_generation_operations
          WHERE owner_kind='cv' AND agentic_transport_descriptor IS NOT NULL) THEN
          RAISE EXCEPTION 'Preserve Nodia CV Agentic receipts before reverting';
        END IF;
      END $guard$;
      DROP INDEX ix_cv_agentic_pending;
      DROP INDEX ux_cv_agentic_attempt;
      ALTER TABLE ai_generation_operations
        DROP CONSTRAINT ck_cv_agentic_lifecycle,
        DROP CONSTRAINT ck_cv_agentic_custody,
        DROP CONSTRAINT ck_generation_agentic_descriptor,
        DROP COLUMN cv_agentic_native,
        ADD CONSTRAINT ck_teacher_agentic_descriptor CHECK(
          agentic_transport_descriptor IS NULL OR coalesce(${teacherDescriptor},false));
    `);
  }
}
