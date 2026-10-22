import type { MigrationInterface, QueryRunner } from 'typeorm';

/** One content-owned index: no search document, extra table or retention outside message parts. */
export class AddNodiaAiTextSearchIndex1793100000000 implements MigrationInterface {
  name = 'AddNodiaAiTextSearchIndex1793100000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
          WHERE e.extname='pg_trgm' AND n.nspname='public'
        ) THEN
          RAISE EXCEPTION 'NodiaAI text search requires pg_trgm installed in schema public';
        END IF;
      END $$;
      CREATE INDEX ix_nodia_ai_message_parts_text_search
        ON public.nodia_ai_message_parts USING gin(text public.gin_trgm_ops)
        WHERE kind='text';
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    // A shared extension can have independent consumers; this migration owns only its index.
    await runner.query('DROP INDEX public.ix_nodia_ai_message_parts_text_search');
  }
}
