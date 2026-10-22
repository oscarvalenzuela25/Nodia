import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Frozen M1 only: no speculative attachment, execution, preference or adapter-state references. */
export class CreateNodiaAiConversationPersistence1792200000000 implements MigrationInterface {
  name = 'CreateNodiaAiConversationPersistence1792200000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE nodia_ai_conversations (
        id uuid PRIMARY KEY,
        owner_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        client_request_id uuid NOT NULL,
        title text,
        is_pinned boolean NOT NULL DEFAULT false,
        is_archived boolean NOT NULL DEFAULT false,
        revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
        retention_epoch bigint NOT NULL DEFAULT 1 CHECK (retention_epoch > 0),
        selected_connection_id bigint REFERENCES ai_providers(id) ON DELETE SET NULL,
        selected_mode text,
        selected_model_id text,
        selected_effort_id text,
        routing_revision integer NOT NULL DEFAULT 1 CHECK (routing_revision > 0),
        routing_enabled boolean NOT NULL DEFAULT false,
        routing_target_selection jsonb,
        active_job_id uuid,
        next_message_seq bigint NOT NULL DEFAULT 0 CHECK (next_message_seq >= 0),
        next_event_seq bigint NOT NULL DEFAULT 0 CHECK (next_event_seq >= 0),
        last_owner_message_at timestamptz,
        expires_at timestamptz NOT NULL,
        lifecycle text NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active','expiring')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        creation_request_hash char(64) NOT NULL CHECK (creation_request_hash ~ '^[0-9a-f]{64}$'),
        UNIQUE (owner_id, client_request_id),
        CHECK (title IS NULL OR (octet_length(title) BETWEEN 1 AND 256 AND btrim(title) <> '')),
        CHECK (
          (selected_mode IS NULL AND selected_model_id IS NULL AND selected_effort_id IS NULL AND selected_connection_id IS NULL)
          OR (selected_mode IS NOT NULL AND selected_mode IN ('api_key','token_plan_web','token_plan_agentic') AND selected_model_id IS NOT NULL AND btrim(selected_model_id) <> '')
        ),
        CHECK (selected_effort_id IS NULL OR btrim(selected_effort_id) <> ''),
        CHECK (routing_target_selection IS NULL OR (jsonb_typeof(routing_target_selection) = 'object' AND octet_length(routing_target_selection::text) <= 8192)),
        CHECK (NOT routing_enabled OR routing_target_selection IS NOT NULL),
        CHECK (NOT routing_enabled OR selected_connection_id IS NULL OR
          COALESCE(routing_target_selection #>> '{selection,connection_id}' = selected_connection_id::text,false))
      );
      CREATE INDEX ix_nodia_ai_conversations_owner ON nodia_ai_conversations(owner_id,is_archived,is_pinned,updated_at,id);
      CREATE INDEX ix_nodia_ai_conversations_expiry ON nodia_ai_conversations(expires_at,id) WHERE lifecycle='active';

      CREATE TABLE nodia_ai_messages (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES nodia_ai_conversations(id) ON DELETE CASCADE,
        seq bigint NOT NULL CHECK (seq > 0),
        role text NOT NULL CHECK (role IN ('user','assistant')),
        author_id bigint REFERENCES users(id) ON DELETE RESTRICT,
        client_message_id uuid,
        status text NOT NULL CHECK (status IN ('streaming','sealed','partial')),
        source_scope_manifest jsonb NOT NULL CHECK (jsonb_typeof(source_scope_manifest)='object' AND octet_length(source_scope_manifest::text)<=65536),
        created_at timestamptz NOT NULL DEFAULT now(),
        sealed_at timestamptz,
        input_hash char(64),
        UNIQUE(id,conversation_id), UNIQUE(conversation_id,seq), UNIQUE(conversation_id,author_id,client_message_id),
        CHECK (role <> 'user' OR (author_id IS NOT NULL AND client_message_id IS NOT NULL AND input_hash IS NOT NULL)),
        CHECK (input_hash IS NULL OR input_hash ~ '^[0-9a-f]{64}$'),
        CHECK ((status='streaming' AND sealed_at IS NULL) OR (status IN ('sealed','partial') AND sealed_at IS NOT NULL))
      );
      CREATE TABLE nodia_ai_message_parts (
        message_id uuid NOT NULL,
        conversation_id uuid NOT NULL,
        part_index integer NOT NULL CHECK (part_index >= 0 AND part_index < 8),
        kind text NOT NULL CHECK (kind='text'),
        text text NOT NULL CHECK (octet_length(text) BETWEEN 1 AND 32768),
        PRIMARY KEY(message_id,part_index),
        FOREIGN KEY(message_id,conversation_id) REFERENCES nodia_ai_messages(id,conversation_id) ON DELETE CASCADE
      );

      CREATE TABLE nodia_ai_runs (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES nodia_ai_conversations(id) ON DELETE CASCADE,
        actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        user_message_id uuid NOT NULL UNIQUE,
        assistant_message_id uuid UNIQUE,
        connection_id bigint REFERENCES ai_providers(id) ON DELETE SET NULL,
        selection_snapshot jsonb NOT NULL CHECK (jsonb_typeof(selection_snapshot)='object' AND octet_length(selection_snapshot::text)<=8192),
        catalog_version text NOT NULL CHECK (btrim(catalog_version)<>''),
        policy_version text NOT NULL CHECK (btrim(policy_version)<>''),
        policy_hash char(64) NOT NULL CHECK (policy_hash ~ '^[0-9a-f]{64}$'),
        routing_snapshot jsonb NOT NULL CHECK (jsonb_typeof(routing_snapshot)='object' AND octet_length(routing_snapshot::text)<=16384),
        budget_snapshot jsonb NOT NULL CHECK (jsonb_typeof(budget_snapshot)='object' AND octet_length(budget_snapshot::text)<=2048),
        tool_calls_used integer NOT NULL DEFAULT 0 CHECK (tool_calls_used >= 0),
        mcp_rpc_messages_used integer NOT NULL DEFAULT 0 CHECK (mcp_rpc_messages_used >= 0),
        provider_dispatches_used integer NOT NULL DEFAULT 0 CHECK (provider_dispatches_used >= 0),
        compactions_used integer NOT NULL DEFAULT 0 CHECK (compactions_used >= 0),
        delegations_used integer NOT NULL DEFAULT 0 CHECK (delegations_used >= 0),
        input_through_seq bigint NOT NULL CHECK (input_through_seq > 0),
        revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
        state text NOT NULL CHECK (state IN ('queued','running','waiting_for_user','completed','failed','cancel_requested','cancelled','unknown')),
        phase text NOT NULL CHECK (btrim(phase)<>'' AND octet_length(phase)<=128),
        deadline_at timestamptz NOT NULL,
        error_code text CHECK (error_code IS NULL OR (btrim(error_code)<>'' AND octet_length(error_code)<=128)),
        created_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        retention_epoch bigint NOT NULL CHECK (retention_epoch > 0),
        context_manifest jsonb NOT NULL CHECK (jsonb_typeof(context_manifest)='object' AND octet_length(context_manifest::text)<=65536),
        UNIQUE(id,conversation_id),
        FOREIGN KEY(user_message_id,conversation_id) REFERENCES nodia_ai_messages(id,conversation_id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
        FOREIGN KEY(assistant_message_id,conversation_id) REFERENCES nodia_ai_messages(id,conversation_id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
        CHECK (jsonb_typeof(budget_snapshot->'tool_calls')='number' AND jsonb_typeof(budget_snapshot->'mcp_rpc_messages')='number' AND jsonb_typeof(budget_snapshot->'provider_dispatches')='number' AND jsonb_typeof(budget_snapshot->'compactions')='number' AND jsonb_typeof(budget_snapshot->'delegations')='number'),
        CHECK (budget_snapshot @> '{"schema_version":1}'::jsonb AND budget_snapshot ?& ARRAY['tool_calls','mcp_rpc_messages','provider_dispatches','compactions','delegations']),
        CHECK (tool_calls_used <= (budget_snapshot->>'tool_calls')::integer AND (budget_snapshot->>'tool_calls')::integer >= 0),
        CHECK (mcp_rpc_messages_used <= (budget_snapshot->>'mcp_rpc_messages')::integer AND (budget_snapshot->>'mcp_rpc_messages')::integer >= 0),
        CHECK (provider_dispatches_used <= (budget_snapshot->>'provider_dispatches')::integer AND (budget_snapshot->>'provider_dispatches')::integer > 0),
        CHECK (compactions_used <= (budget_snapshot->>'compactions')::integer AND (budget_snapshot->>'compactions')::integer >= 0),
        CHECK (delegations_used <= (budget_snapshot->>'delegations')::integer AND (budget_snapshot->>'delegations')::integer BETWEEN 0 AND 1)
      );
      CREATE INDEX ix_nodia_ai_runs_chat ON nodia_ai_runs(conversation_id,created_at,id);
      CREATE UNIQUE INDEX uq_nodia_ai_runs_active ON nodia_ai_runs(conversation_id) WHERE state IN ('queued','running','cancel_requested','unknown');
      CREATE TABLE nodia_ai_tool_calls (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES nodia_ai_conversations(id) ON DELETE CASCADE,
        run_id uuid NOT NULL,
        adapter_call_id text NOT NULL CHECK (octet_length(adapter_call_id) BETWEEN 1 AND 512),
        tool_name text NOT NULL CHECK (octet_length(tool_name) BETWEEN 1 AND 256),
        contract_hash char(64) NOT NULL CHECK (contract_hash ~ '^[0-9a-f]{64}$'),
        arguments_hash char(64) NOT NULL CHECK (arguments_hash ~ '^[0-9a-f]{64}$'),
        arguments jsonb NOT NULL CHECK (jsonb_typeof(arguments)='object' AND octet_length(arguments::text)<=65536),
        public_result jsonb CHECK (public_result IS NULL OR (jsonb_typeof(public_result)='object' AND octet_length(public_result::text)<=65536)),
        scope_manifest jsonb NOT NULL CHECK (jsonb_typeof(scope_manifest)='object' AND octet_length(scope_manifest::text)<=65536),
        state text NOT NULL CHECK (state IN ('received','validated','completed','rejected','unknown')),
        created_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        UNIQUE(id,conversation_id), UNIQUE(run_id,adapter_call_id),
        FOREIGN KEY(run_id,conversation_id) REFERENCES nodia_ai_runs(id,conversation_id) ON DELETE CASCADE
      );
      CREATE INDEX ix_nodia_ai_tool_calls_run ON nodia_ai_tool_calls(run_id,created_at);
      CREATE TABLE nodia_ai_events (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES nodia_ai_conversations(id) ON DELETE CASCADE,
        seq bigint NOT NULL CHECK (seq > 0),
        event_key text NOT NULL CHECK (octet_length(event_key) BETWEEN 1 AND 256),
        run_id uuid,
        public_payload jsonb NOT NULL CHECK (jsonb_typeof(public_payload)='object' AND octet_length(public_payload::text)<=65536),
        scope_manifest jsonb NOT NULL CHECK (jsonb_typeof(scope_manifest)='object' AND octet_length(scope_manifest::text)<=65536),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(conversation_id,seq), UNIQUE(conversation_id,event_key),
        FOREIGN KEY(run_id,conversation_id) REFERENCES nodia_ai_runs(id,conversation_id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED
      );

      CREATE TABLE nodia_ai_jobs (
        id uuid PRIMARY KEY,
        kind text NOT NULL CHECK (kind IN ('turn','expire_chat','delete_blob','reconcile')),
        dedup_key text NOT NULL UNIQUE CHECK (octet_length(dedup_key) BETWEEN 1 AND 512),
        conversation_id uuid REFERENCES nodia_ai_conversations(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,
        run_id uuid,
        storage_key text,
        storage_generation uuid,
        recovery_descriptor jsonb CHECK (recovery_descriptor IS NULL OR (jsonb_typeof(recovery_descriptor)='object' AND octet_length(recovery_descriptor::text)<=8192)),
        state text NOT NULL CHECK (state IN ('ready','leased','waiting','done','failed','cancelled','unknown')),
        available_at timestamptz NOT NULL,
        lease_owner uuid,
        lease_until timestamptz,
        fence bigint NOT NULL DEFAULT 0 CHECK (fence>=0),
        attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count>=0),
        deadline_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        stage_key text NOT NULL CHECK (octet_length(stage_key) BETWEEN 1 AND 128),
        stage_seq integer NOT NULL DEFAULT 1 CHECK (stage_seq>0),
        UNIQUE(id,conversation_id),
        FOREIGN KEY(run_id,conversation_id) REFERENCES nodia_ai_runs(id,conversation_id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
        CHECK (run_id IS NULL OR conversation_id IS NOT NULL),
        CHECK ((storage_key IS NULL)=(storage_generation IS NULL)),
        CHECK (storage_key IS NULL OR octet_length(storage_key) BETWEEN 1 AND 1024),
        CHECK (kind <> 'delete_blob' OR storage_key IS NOT NULL),
        CHECK (kind <> 'turn' OR run_id IS NOT NULL OR (state='unknown' AND recovery_descriptor IS NOT NULL)),
        CHECK (state<>'leased' OR (lease_owner IS NOT NULL AND lease_until IS NOT NULL AND fence>0))
      );
      CREATE INDEX ix_nodia_ai_jobs_ready ON nodia_ai_jobs(available_at,id) WHERE state='ready';
      CREATE INDEX ix_nodia_ai_jobs_lease ON nodia_ai_jobs(lease_until,id) WHERE state='leased';
      ALTER TABLE nodia_ai_conversations ADD CONSTRAINT fk_nodia_ai_active_job
        FOREIGN KEY(active_job_id,id) REFERENCES nodia_ai_jobs(id,conversation_id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;

      CREATE TABLE nodia_ai_execution_grants (
        id uuid PRIMARY KEY,
        actor_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        session_public_id uuid REFERENCES auth_sessions(public_id) ON DELETE SET NULL,
        run_id uuid NOT NULL UNIQUE REFERENCES nodia_ai_runs(id) ON DELETE CASCADE,
        allowed_modules jsonb NOT NULL CHECK (jsonb_typeof(allowed_modules)='array' AND jsonb_array_length(allowed_modules)<=128),
        allowed_operations jsonb NOT NULL CHECK (jsonb_typeof(allowed_operations)='array' AND jsonb_array_length(allowed_operations)<=128),
        allowed_scope jsonb NOT NULL CHECK (jsonb_typeof(allowed_scope)='object' AND octet_length(allowed_scope::text)<=65536),
        policy_version text NOT NULL CHECK (btrim(policy_version)<>''),
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_nodia_ai_grants_session ON nodia_ai_execution_grants(session_public_id,revoked_at);
      CREATE INDEX ix_nodia_ai_grants_expiry ON nodia_ai_execution_grants(expires_at);
      CREATE TABLE nodia_ai_runtime_slots (
        resource_key text PRIMARY KEY CHECK (octet_length(resource_key) BETWEEN 1 AND 512),
        state text NOT NULL CHECK (state IN ('free','held','unknown')),
        conversation_id uuid REFERENCES nodia_ai_conversations(id) ON DELETE SET NULL,
        job_id uuid,
        holder_worker_id uuid,
        fence bigint NOT NULL DEFAULT 0 CHECK (fence>=0),
        lease_until timestamptz,
        external_operation_ref text CHECK (external_operation_ref IS NULL OR octet_length(external_operation_ref) BETWEEN 1 AND 512),
        updated_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY(job_id,conversation_id) REFERENCES nodia_ai_jobs(id,conversation_id) ON DELETE SET NULL,
        CHECK (state<>'free' OR (conversation_id IS NULL AND job_id IS NULL AND holder_worker_id IS NULL AND lease_until IS NULL AND external_operation_ref IS NULL)),
        CHECK (state<>'held' OR (holder_worker_id IS NOT NULL AND lease_until IS NOT NULL AND fence>0))
      );
      CREATE INDEX ix_nodia_ai_runtime_slots_state ON nodia_ai_runtime_slots(state,lease_until);
      CREATE TABLE nodia_ai_job_attempts (
        id uuid PRIMARY KEY,
        job_id uuid NOT NULL REFERENCES nodia_ai_jobs(id) ON DELETE CASCADE,
        attempt_no integer NOT NULL CHECK (attempt_no>0),
        fence bigint NOT NULL CHECK (fence>0),
        worker_id uuid NOT NULL,
        phase text NOT NULL CHECK (octet_length(phase) BETWEEN 1 AND 128),
        error_code text CHECK (error_code IS NULL OR octet_length(error_code) BETWEEN 1 AND 128),
        external_operation_ref text CHECK (external_operation_ref IS NULL OR octet_length(external_operation_ref) BETWEEN 1 AND 512),
        started_at timestamptz NOT NULL,
        ended_at timestamptz,
        runtime_resource_key text REFERENCES nodia_ai_runtime_slots(resource_key) ON DELETE SET NULL,
        runtime_fence bigint CHECK (runtime_fence IS NULL OR runtime_fence>0),
        stage_key text NOT NULL CHECK (octet_length(stage_key) BETWEEN 1 AND 128),
        stage_seq integer NOT NULL CHECK (stage_seq>0),
        selection_snapshot jsonb CHECK (selection_snapshot IS NULL OR (jsonb_typeof(selection_snapshot)='object' AND octet_length(selection_snapshot::text)<=8192)),
        routing_phase text CHECK (routing_phase IN ('base','delegated')),
        UNIQUE(job_id,attempt_no), UNIQUE(job_id,fence),
        CHECK ((selection_snapshot IS NULL)=(routing_phase IS NULL))
      );
      CREATE INDEX ix_nodia_ai_attempts_job ON nodia_ai_job_attempts(job_id,started_at);
      CREATE TABLE nodia_ai_audit_events (
        id uuid PRIMARY KEY,
        actor_id bigint REFERENCES users(id) ON DELETE RESTRICT,
        session_public_id uuid REFERENCES auth_sessions(public_id) ON DELETE SET NULL,
        conversation_id uuid REFERENCES nodia_ai_conversations(id) ON DELETE CASCADE,
        event_key text NOT NULL CHECK (octet_length(event_key) BETWEEN 1 AND 128),
        correlation_id uuid NOT NULL,
        minimal_details jsonb CHECK (minimal_details IS NULL OR (jsonb_typeof(minimal_details)='object' AND octet_length(minimal_details::text)<=8192)),
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX ix_nodia_ai_audit_actor ON nodia_ai_audit_events(actor_id,created_at,id);
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    // Explicit rollback removes M1 content. Restore from a verified backup to preserve it.
    await runner.query(`
      ALTER TABLE nodia_ai_conversations DROP CONSTRAINT fk_nodia_ai_active_job;
      DROP TABLE nodia_ai_audit_events;
      DROP TABLE nodia_ai_job_attempts;
      DROP TABLE nodia_ai_runtime_slots;
      DROP TABLE nodia_ai_execution_grants;
      DROP TABLE nodia_ai_jobs;
      DROP TABLE nodia_ai_events;
      DROP TABLE nodia_ai_tool_calls;
      DROP TABLE nodia_ai_runs;
      DROP TABLE nodia_ai_message_parts;
      DROP TABLE nodia_ai_messages;
      DROP TABLE nodia_ai_conversations;
    `);
  }
}
