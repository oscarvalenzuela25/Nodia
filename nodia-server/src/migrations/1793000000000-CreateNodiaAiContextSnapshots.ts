import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Remaining M4: immutable, same-chat compaction artifacts. No original history is removed. */
export class CreateNodiaAiContextSnapshots1793000000000 implements MigrationInterface {
  name = 'CreateNodiaAiContextSnapshots1793000000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE nodia_ai_context_snapshots (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES nodia_ai_conversations(id) ON DELETE CASCADE,
        revision integer NOT NULL CHECK (revision > 0),
        through_message_seq bigint NOT NULL CHECK (through_message_seq >= 0),
        source_hash char(64) NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
        summary jsonb NOT NULL CHECK (jsonb_typeof(summary)='object' AND octet_length(summary::text)<=262144),
        scope_manifest jsonb NOT NULL CHECK (jsonb_typeof(scope_manifest)='object' AND octet_length(scope_manifest::text)<=65536),
        builder_contract_version text NOT NULL CHECK (octet_length(builder_contract_version) BETWEEN 1 AND 128 AND btrim(builder_contract_version)<>''),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(id,conversation_id),
        UNIQUE(conversation_id,revision)
      );
      CREATE INDEX ix_nodia_ai_context_snapshot_anchor ON nodia_ai_context_snapshots(conversation_id,through_message_seq);
      ALTER TABLE nodia_ai_runs ADD COLUMN context_snapshot_id uuid;
      ALTER TABLE nodia_ai_runs ADD CONSTRAINT fk_nodia_ai_run_context_snapshot
        FOREIGN KEY(context_snapshot_id,conversation_id)
        REFERENCES nodia_ai_context_snapshots(id,conversation_id)
        ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
      CREATE INDEX ix_nodia_ai_run_context_snapshot ON nodia_ai_runs(context_snapshot_id,conversation_id)
        WHERE context_snapshot_id IS NOT NULL;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      DO $$ BEGIN
        IF EXISTS(SELECT 1 FROM nodia_ai_context_snapshots)
          OR EXISTS(SELECT 1 FROM nodia_ai_runs WHERE context_snapshot_id IS NOT NULL)
        THEN RAISE EXCEPTION 'Context snapshots require explicit reconciliation before rollback'; END IF;
      END $$;
      ALTER TABLE nodia_ai_runs DROP CONSTRAINT fk_nodia_ai_run_context_snapshot;
      DROP INDEX ix_nodia_ai_run_context_snapshot;
      ALTER TABLE nodia_ai_runs DROP COLUMN context_snapshot_id;
      DROP TABLE nodia_ai_context_snapshots;
    `);
  }
}
