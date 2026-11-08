import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive API HTTP execution metadata. Never stores prompts, credentials or provider payloads. */
export class AddNodiaAiApiChatRuntime1793310000000 implements MigrationInterface {
  name = 'AddNodiaAiApiChatRuntime1793310000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE nodia_ai_api_dispatches (
      attempt_id uuid PRIMARY KEY REFERENCES nodia_ai_job_attempts(id) ON DELETE CASCADE,
      identity jsonb NOT NULL CHECK (jsonb_typeof(identity)='object' AND octet_length(identity::text)<=4096),
      request_hash char(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
      response_hash char(64) CHECK (response_hash IS NULL OR response_hash ~ '^[a-f0-9]{64}$'),
      owner_machine char(64) NOT NULL, owner_boot text NOT NULL,
      owner_pid integer NOT NULL CHECK (owner_pid>0), owner_birth text NOT NULL,
      owner_instance uuid NOT NULL,
      state text NOT NULL CHECK (state IN ('running','closed')),
      exchange_count integer NOT NULL DEFAULT 0 CHECK (exchange_count>=0),
      terminal_proof jsonb CHECK (terminal_proof IS NULL OR (jsonb_typeof(terminal_proof)='object' AND octet_length(terminal_proof::text)<=8192)),
      started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      closed_at timestamptz, acknowledged_at timestamptz,
      CHECK ((state='running' AND terminal_proof IS NULL AND closed_at IS NULL AND acknowledged_at IS NULL)
          OR (state='closed' AND terminal_proof IS NOT NULL AND closed_at IS NOT NULL))
    )`);
    await runner.query(`CREATE TABLE nodia_ai_api_acceptances (
      scope_hash char(64) PRIMARY KEY CHECK (scope_hash ~ '^[a-f0-9]{64}$'),
      provider_key text NOT NULL CHECK (provider_key IN ('openai','gemini')),
      connection_id bigint NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
      configuration_generation char(64) NOT NULL,
      session_generation char(32) NOT NULL,
      model_id text NOT NULL CHECK (octet_length(model_id) BETWEEN 1 AND 1024),
      effort_id text CHECK (effort_id IS NULL OR octet_length(effort_id) BETWEEN 1 AND 256),
      verified_media_types text[] NOT NULL DEFAULT '{}',
      image_generation boolean NOT NULL DEFAULT false,
      evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence)='object' AND octet_length(evidence::text)<=8192),
      observed_at timestamptz NOT NULL
    )`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('LOCK TABLE nodia_ai_api_dispatches IN ACCESS EXCLUSIVE MODE');
    const rows: { present: boolean }[] = await runner.query(
      'SELECT EXISTS(SELECT 1 FROM nodia_ai_api_dispatches) AS present',
    );
    if (rows[0]?.present !== false)
      throw Error('api_chat:rollback_after_execution_requires_matching_release');
    await runner.query('DROP TABLE nodia_ai_api_acceptances');
    await runner.query('DROP TABLE nodia_ai_api_dispatches');
  }
}
