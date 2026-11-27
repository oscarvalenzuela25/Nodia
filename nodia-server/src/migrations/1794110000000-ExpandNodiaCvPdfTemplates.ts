import type { MigrationInterface, QueryRunner } from 'typeorm';

const originalTemplates = "'classic','compact'";
const expandedTemplates = "'classic','compact','editorial','contemporary'";

function changeTemplateChecks(allowed: string) {
  return `
    ALTER TABLE nodia_cv_generations
      DROP CONSTRAINT ck_nodia_cv_version_draft,
      ADD CONSTRAINT ck_nodia_cv_version_draft CHECK (
        (state='expired' OR purpose_version<>'cv_saved_version_copy' OR source_version IS NOT NULL)
        AND (source_version IS NULL OR coalesce((
          jsonb_typeof(source_version)='object'
          AND (source_version-ARRAY['id','template','offer_sha256'])='{}'::jsonb
          AND source_version->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND source_version->>'template' IN (${allowed})
          AND source_version->>'offer_sha256' ~ '^[0-9a-f]{64}$'
          AND state<>'expired' AND NOT qualification AND profile_id IS NULL
          AND profile_snapshot->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND profile_revision IS NOT NULL AND offer_text=''
          AND ((purpose_version='cv_saved_version_copy' AND state='ready' AND selection_snapshot IS NULL)
            OR purpose_version='cv_tailoring_edit')
        ),false))
      );
    ALTER TABLE nodia_cv_draft_pdfs
      DROP CONSTRAINT nodia_cv_draft_pdfs_template_check,
      ADD CONSTRAINT nodia_cv_draft_pdfs_template_check CHECK (template IN (${allowed}));
    ALTER TABLE nodia_cv_versions
      DROP CONSTRAINT nodia_cv_versions_template_check,
      ADD CONSTRAINT nodia_cv_versions_template_check CHECK (template IN (${allowed}));
  `;
}

export class ExpandNodiaCvPdfTemplates1794110000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(changeTemplateChecks(expandedTemplates));
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE nodia_cv_generations, nodia_cv_draft_pdfs, nodia_cv_versions IN ACCESS EXCLUSIVE MODE;
      DO $guard$ BEGIN
        IF EXISTS (SELECT 1 FROM nodia_cv_generations WHERE source_version->>'template' NOT IN (${originalTemplates}))
          OR EXISTS (SELECT 1 FROM nodia_cv_draft_pdfs WHERE template NOT IN (${originalTemplates}))
          OR EXISTS (SELECT 1 FROM nodia_cv_versions WHERE template NOT IN (${originalTemplates})) THEN
          RAISE EXCEPTION 'Preserve Nodia CV versions and drafts using new templates before reverting';
        END IF;
      END $guard$;
      ${changeTemplateChecks(originalTemplates)}
    `);
  }
}
