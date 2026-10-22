import type { MigrationInterface, QueryRunner } from 'typeorm';
/** M4 preferences only. AI-34 owns snapshots separately. */
export class CreateNodiaAiPreferences1792900000000 implements MigrationInterface {
  name = 'CreateNodiaAiPreferences1792900000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE nodia_ai_preferences (
      id uuid PRIMARY KEY,
      owner_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      scope_key text NOT NULL CHECK(scope_key IN ('finance','business','rental')),
      scope_hash char(64) NOT NULL CHECK(scope_hash ~ '^[0-9a-f]{64}$'),
      scope jsonb NOT NULL CHECK(jsonb_typeof(scope)='object'),
      key text NOT NULL,
      value jsonb NOT NULL CHECK(jsonb_typeof(value)='string'),
      revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
      source_conversation_id uuid REFERENCES nodia_ai_conversations(id) ON DELETE SET NULL,
      accepted_step_id uuid REFERENCES nodia_ai_execution_steps(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(owner_id,scope_hash,key),
      CHECK((scope_key='finance' AND key IN ('expense_category_id','income_category_id') AND scope='{}'::jsonb)
        OR (scope_key='business' AND key='business_id' AND scope='{}'::jsonb)
        OR (scope_key='business' AND key='supplier_id' AND (scope ? 'business_id') AND (scope - 'business_id')='{}'::jsonb AND jsonb_typeof(scope->'business_id')='string' AND (scope->>'business_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
        OR (scope_key='rental' AND key='property_id' AND scope='{}'::jsonb)),
      CHECK(CASE WHEN key='business_id' THEN (value#>>'{}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        WHEN (value#>>'{}') ~ '^[1-9][0-9]{0,18}$' THEN (value#>>'{}')::numeric<=9223372036854775807 ELSE false END)
    );
    CREATE INDEX ix_nodia_ai_preference_origin_chat ON nodia_ai_preferences(source_conversation_id) WHERE source_conversation_id IS NOT NULL;
    CREATE INDEX ix_nodia_ai_preference_origin_step ON nodia_ai_preferences(accepted_step_id) WHERE accepted_step_id IS NOT NULL;
    `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      `DO $$ BEGIN IF EXISTS(SELECT 1 FROM nodia_ai_preferences) THEN RAISE EXCEPTION 'Accepted preferences require explicit reconciliation before rollback'; END IF; END $$; DROP TABLE nodia_ai_preferences;`,
    );
  }
}
