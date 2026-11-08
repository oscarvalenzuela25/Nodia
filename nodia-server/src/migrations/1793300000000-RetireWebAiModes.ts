import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Coordinated upgrade: stop admission/workers and retain an external DB backup first. */
export class RetireWebAiModes1793300000000 implements MigrationInterface {
  name = 'RetireWebAiModes1793300000000';

  private async quiet(runner: QueryRunner): Promise<void> {
    await runner.query(`SET LOCAL lock_timeout = '10s'`);
    await runner.query(`LOCK TABLE ai_provider_catalog, ai_providers, nodia_ai_conversations,
      nodia_ai_jobs, nodia_ai_job_attempts, nodia_ai_runtime_slots IN ACCESS EXCLUSIVE MODE`);
    const rows: { busy: boolean }[] = await runner.query(`SELECT
      EXISTS(SELECT 1 FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown'))
      OR EXISTS(SELECT 1 FROM nodia_ai_job_attempts WHERE ended_at IS NULL)
      OR EXISTS(SELECT 1 FROM nodia_ai_runtime_slots WHERE state <> 'free')
      OR EXISTS(SELECT 1 FROM nodia_ai_conversations WHERE active_job_id IS NOT NULL) AS busy`);
    if (rows[0]?.busy !== false) throw new Error('ai_modes:runtime_not_quiet');
  }

  async up(runner: QueryRunner): Promise<void> {
    await this.quiet(runner);
    const conflicts: { id: string }[] =
      await runner.query(`SELECT id::text FROM ai_providers
      WHERE fields ? 'agentic' AND fields ? 'token_plan_agentic'
      AND fields->'agentic' IS DISTINCT FROM fields->'token_plan_agentic' LIMIT 1`);
    if (conflicts.length)
      throw new Error('ai_modes:agentic_configuration_conflict');
    await runner.query(`CREATE TABLE ai_mode_retirement_backup (
      kind text NOT NULL, resource_id text NOT NULL, before_state jsonb NOT NULL,
      after_state jsonb, PRIMARY KEY(kind,resource_id))`);
    await runner.query(`INSERT INTO ai_mode_retirement_backup(kind,resource_id,before_state)
      SELECT 'catalog',id::text,jsonb_build_object('web',can_use_token_plan_web,'agentic',can_use_token_plan_agentic)
      FROM ai_provider_catalog`);
    await runner.query(`INSERT INTO ai_mode_retirement_backup(kind,resource_id,before_state)
      SELECT 'provider',id::text,jsonb_build_object('web',use_token_plan_web,'agentic',use_token_plan_agentic,
        'default_mode',default_mode,'fields',fields) FROM ai_providers`);
    await runner.query(`INSERT INTO ai_mode_retirement_backup(kind,resource_id,before_state)
      SELECT 'conversation',id::text,jsonb_build_object('selected_mode',selected_mode,
        'selected_connection_id',selected_connection_id::text,'selected_model_id',selected_model_id,
        'selected_effort_id',selected_effort_id,'routing_enabled',routing_enabled,
        'routing_target_selection',routing_target_selection,'routing_revision',routing_revision,
        'revision',revision,'updated_at',updated_at)
      FROM nodia_ai_conversations WHERE selected_mode IN ('token_plan_web','token_plan_agentic')
        OR routing_enabled OR routing_target_selection IS NOT NULL`);
    const constraints: { conname: string; definition: string }[] =
      await runner.query(`SELECT conname,
      pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid='nodia_ai_conversations'::regclass AND contype='c'
        AND pg_get_constraintdef(oid) LIKE '%selected_mode%'`);
    for (const constraint of constraints) {
      await runner.query(
        `INSERT INTO ai_mode_retirement_backup(kind,resource_id,before_state)
        VALUES('constraint',$1,$2::jsonb)`,
        [
          constraint.conname,
          JSON.stringify({ definition: constraint.definition }),
        ],
      );
      await runner.query(
        `ALTER TABLE nodia_ai_conversations DROP CONSTRAINT "${constraint.conname.replaceAll('"', '""')}"`,
      );
    }
    await runner.query(
      `ALTER TABLE ai_providers DROP CONSTRAINT IF EXISTS chk_ai_providers_default_mode`,
    );
    await runner.query(
      `ALTER TABLE ai_provider_catalog RENAME COLUMN can_use_token_plan_agentic TO can_use_agentic`,
    );
    await runner.query(
      `ALTER TABLE ai_providers RENAME COLUMN use_token_plan_agentic TO use_agentic`,
    );
    await runner.query(`UPDATE ai_providers SET fields =
      (fields - 'token_plan_web' - 'token_plan_agentic' - 'engine')
      || CASE WHEN fields ? 'token_plan_agentic'
        THEN jsonb_build_object('agentic',fields->'token_plan_agentic') ELSE '{}'::jsonb END`);
    // Flat preferences of the retired default must never become API/Agentic preferences.
    await runner.query(`UPDATE ai_providers SET fields = fields - ARRAY['selected_model','default_model','model','chat_model','ocr_model',
      'ocr_focus_model','thinking_level','thinking_levels','enable_extended_thinking','available_models']::text[]
      WHERE default_mode IN ('token_plan_web','web_session')`);
    await runner.query(`UPDATE ai_providers SET default_mode = CASE
      WHEN default_mode='token_plan_agentic' THEN 'agentic'
      WHEN default_mode IN ('token_plan_web','web_session') THEN NULL ELSE default_mode END`);
    await runner.query(
      `ALTER TABLE ai_provider_catalog DROP COLUMN can_use_token_plan_web`,
    );
    await runner.query(
      `ALTER TABLE ai_providers DROP COLUMN use_token_plan_web`,
    );
    await runner.query(`ALTER TABLE ai_providers ADD CONSTRAINT chk_ai_providers_default_mode
      CHECK(default_mode IS NULL OR default_mode IN ('agentic','api_key'))`);
    await runner.query(`UPDATE nodia_ai_conversations SET
      selected_connection_id=CASE WHEN selected_mode='token_plan_web' THEN NULL ELSE selected_connection_id END,
      selected_model_id=CASE WHEN selected_mode='token_plan_web' THEN NULL ELSE selected_model_id END,
      selected_effort_id=CASE WHEN selected_mode='token_plan_web' THEN NULL ELSE selected_effort_id END,
      selected_mode=CASE WHEN selected_mode='token_plan_web' THEN NULL
        WHEN selected_mode='token_plan_agentic' THEN 'agentic' ELSE selected_mode END,
      routing_enabled=false,routing_target_selection=NULL,routing_revision=routing_revision+1,
      revision=revision+1,updated_at=now()
      WHERE selected_mode IN ('token_plan_web','token_plan_agentic')
        OR routing_enabled OR routing_target_selection IS NOT NULL`);
    await runner.query(`ALTER TABLE nodia_ai_conversations ADD CONSTRAINT ck_nodia_ai_selection_modes_v2 CHECK (
      (selected_mode IS NULL AND selected_model_id IS NULL AND selected_effort_id IS NULL AND selected_connection_id IS NULL)
      OR (selected_mode IS NOT NULL AND selected_mode IN ('agentic','api_key') AND selected_model_id IS NOT NULL AND btrim(selected_model_id)<>''))`);
    await runner.query(`ALTER TABLE nodia_ai_conversations ADD CONSTRAINT ck_nodia_ai_routing_retired_v2
      CHECK(NOT routing_enabled AND routing_target_selection IS NULL)`);
    await runner.query(`UPDATE ai_mode_retirement_backup b SET after_state=jsonb_build_object(
      'agentic',p.use_agentic,'default_mode',p.default_mode,'fields',p.fields)
      FROM ai_providers p WHERE b.kind='provider' AND b.resource_id=p.id::text`);
    await runner.query(`UPDATE ai_mode_retirement_backup b SET after_state=jsonb_build_object('agentic',c.can_use_agentic)
      FROM ai_provider_catalog c WHERE b.kind='catalog' AND b.resource_id=c.id::text`);
    await runner.query(`UPDATE ai_mode_retirement_backup b SET after_state=jsonb_build_object(
      'selected_mode',c.selected_mode,'selected_connection_id',c.selected_connection_id::text,
      'selected_model_id',c.selected_model_id,'selected_effort_id',c.selected_effort_id,
      'routing_enabled',c.routing_enabled,'routing_target_selection',c.routing_target_selection,
      'routing_revision',c.routing_revision,'revision',c.revision,'updated_at',c.updated_at)
      FROM nodia_ai_conversations c WHERE b.kind='conversation' AND b.resource_id=c.id::text`);
  }

  async down(runner: QueryRunner): Promise<void> {
    await this.quiet(runner);
    const changed: { changed: boolean }[] =
      await runner.query(`SELECT EXISTS(SELECT 1 FROM ai_providers p WHERE NOT EXISTS(SELECT 1 FROM ai_mode_retirement_backup b WHERE b.kind='provider' AND b.resource_id=p.id::text)) OR EXISTS(SELECT 1 FROM ai_provider_catalog c WHERE NOT EXISTS(SELECT 1 FROM ai_mode_retirement_backup b WHERE b.kind='catalog' AND b.resource_id=c.id::text)) OR EXISTS(SELECT 1 FROM nodia_ai_conversations c WHERE c.selected_mode='agentic' AND NOT EXISTS(SELECT 1 FROM ai_mode_retirement_backup b WHERE b.kind='conversation' AND b.resource_id=c.id::text)) OR EXISTS(
      SELECT 1 FROM ai_mode_retirement_backup b LEFT JOIN ai_providers p ON p.id::text=b.resource_id
      WHERE b.kind='provider' AND (p.id IS NULL OR b.after_state IS DISTINCT FROM jsonb_build_object(
        'agentic',p.use_agentic,'default_mode',p.default_mode,'fields',p.fields)))
      OR EXISTS(SELECT 1 FROM ai_mode_retirement_backup b LEFT JOIN ai_provider_catalog c ON c.id::text=b.resource_id
        WHERE b.kind='catalog' AND (c.id IS NULL OR b.after_state IS DISTINCT FROM jsonb_build_object('agentic',c.can_use_agentic)))
      OR EXISTS(SELECT 1 FROM ai_mode_retirement_backup b LEFT JOIN nodia_ai_conversations c ON c.id::text=b.resource_id
        WHERE b.kind='conversation' AND (c.id IS NULL OR b.after_state IS DISTINCT FROM jsonb_build_object(
          'selected_mode',c.selected_mode,'selected_connection_id',c.selected_connection_id::text,
          'selected_model_id',c.selected_model_id,'selected_effort_id',c.selected_effort_id,
          'routing_enabled',c.routing_enabled,'routing_target_selection',c.routing_target_selection,
          'routing_revision',c.routing_revision,'revision',c.revision,'updated_at',c.updated_at))) AS changed`);
    if (changed[0]?.changed !== false)
      throw new Error('ai_modes:rollback_would_overwrite_changes');
    await runner.query(`ALTER TABLE nodia_ai_conversations DROP CONSTRAINT ck_nodia_ai_selection_modes_v2,
      DROP CONSTRAINT ck_nodia_ai_routing_retired_v2`);
    await runner.query(
      `ALTER TABLE ai_providers DROP CONSTRAINT chk_ai_providers_default_mode`,
    );
    await runner.query(
      `ALTER TABLE ai_provider_catalog RENAME COLUMN can_use_agentic TO can_use_token_plan_agentic`,
    );
    await runner.query(
      `ALTER TABLE ai_providers RENAME COLUMN use_agentic TO use_token_plan_agentic`,
    );
    await runner.query(
      `ALTER TABLE ai_provider_catalog ADD COLUMN can_use_token_plan_web boolean NOT NULL DEFAULT false`,
    );
    await runner.query(
      `ALTER TABLE ai_providers ADD COLUMN use_token_plan_web boolean NOT NULL DEFAULT false`,
    );
    await runner.query(`UPDATE ai_provider_catalog c SET can_use_token_plan_web=(b.before_state->>'web')::boolean,
      can_use_token_plan_agentic=(b.before_state->>'agentic')::boolean
      FROM ai_mode_retirement_backup b WHERE b.kind='catalog' AND b.resource_id=c.id::text`);
    await runner.query(`UPDATE ai_providers p SET use_token_plan_web=(b.before_state->>'web')::boolean,
      use_token_plan_agentic=(b.before_state->>'agentic')::boolean,default_mode=b.before_state->>'default_mode',
      fields=b.before_state->'fields' FROM ai_mode_retirement_backup b
      WHERE b.kind='provider' AND b.resource_id=p.id::text`);
    await runner.query(`UPDATE nodia_ai_conversations c SET selected_mode=b.before_state->>'selected_mode',
      selected_connection_id=(b.before_state->>'selected_connection_id')::bigint,
      selected_model_id=b.before_state->>'selected_model_id',selected_effort_id=b.before_state->>'selected_effort_id',
      routing_enabled=(b.before_state->>'routing_enabled')::boolean,
      routing_target_selection=NULLIF(b.before_state->'routing_target_selection','null'::jsonb),
      routing_revision=(b.before_state->>'routing_revision')::integer,
      revision=(b.before_state->>'revision')::integer,updated_at=(b.before_state->>'updated_at')::timestamptz
      FROM ai_mode_retirement_backup b WHERE b.kind='conversation' AND b.resource_id=c.id::text`);
    await runner.query(`ALTER TABLE ai_providers ADD CONSTRAINT chk_ai_providers_default_mode
      CHECK(default_mode IS NULL OR default_mode IN ('api_key','token_plan_web','token_plan_agentic'))`);
    const constraints: { resource_id: string; definition: string }[] =
      await runner.query(`SELECT resource_id,
      before_state->>'definition' AS definition FROM ai_mode_retirement_backup WHERE kind='constraint'`);
    for (const constraint of constraints)
      await runner.query(
        `ALTER TABLE nodia_ai_conversations ADD CONSTRAINT "${constraint.resource_id.replaceAll('"', '""')}" ${constraint.definition}`,
      );
    await runner.query(`DROP TABLE ai_mode_retirement_backup`);
  }
}
