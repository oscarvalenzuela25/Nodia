import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SaveNodiaCvVersionAnalysis1794060000000
  implements MigrationInterface
{
  async up(runner: QueryRunner): Promise<void> {
    // The analysis contains subsets of the 256 KiB draft and 192 KiB review.
    await runner.query(
      `ALTER TABLE nodia_cv_versions
       ADD COLUMN analysis jsonb CHECK (
         analysis IS NULL OR coalesce(
           jsonb_typeof(analysis)='object' AND octet_length(analysis::text)<=524288
           AND jsonb_typeof(analysis->'requirements')='array'
           AND jsonb_typeof(analysis->'facts')='array'
           AND jsonb_typeof(analysis->'evidence')='array',
           false
         )
       )`,
    );
    // A prepared artifact is removed when its draft expires or its review changes.
    // Recover historical analysis only while the exact saved source is still verifiable.
    await runner.query(`
      WITH sources AS MATERIALIZED (
        SELECT v.id, g.draft->'requirements' AS requirements,
          (g.draft->'selectedFacts') || (g.draft->'remainingFacts') AS facts,
          v.snapshot->'evidence' AS evidence
        FROM nodia_cv_draft_pdfs a
        JOIN nodia_cv_generations g ON g.id=a.generation_id AND g.owner_user_id=a.owner_user_id
        JOIN nodia_cv_versions v ON v.source_artifact_id=a.id AND v.owner_user_id=a.owner_user_id
        JOIN nodia_cv_version_pdfs p ON p.version_id=v.id AND p.owner_user_id=v.owner_user_id
        WHERE g.state='ready' AND NOT g.qualification AND g.expires_at>clock_timestamp()
          AND a.review_revision=g.review_revision AND a.review_revision::text=v.snapshot->>'review_revision'
          AND g.profile_id::text=v.snapshot->>'profile_id'
          AND g.profile_revision::text=v.snapshot->>'profile_revision'
          AND encode(sha256(convert_to(g.offer_text,'UTF8')),'hex')=v.snapshot->>'offer_sha256'
          AND a.sha256=p.sha256 AND a.template=v.template AND a.language=v.language
          AND g.draft->>'schemaVersion'='1' AND g.draft->>'locale'=v.language
          AND jsonb_typeof(g.draft->'requirements')='array'
          AND jsonb_typeof(g.draft->'selectedFacts')='array'
          AND jsonb_typeof(g.draft->'remainingFacts')='array'
          AND jsonb_typeof(v.snapshot->'evidence')='array'
          AND v.snapshot->'evidence'=g.review->'evidence'
      )
      UPDATE nodia_cv_versions v
      SET analysis=jsonb_build_object(
        'requirements', s.requirements,
        'facts', coalesce((
          SELECT jsonb_agg(f.value ORDER BY f.ordinality)
          FROM jsonb_array_elements(s.facts) WITH ORDINALITY AS f(value, ordinality)
          WHERE EXISTS (
            SELECT 1 FROM jsonb_array_elements(s.requirements) AS r(value)
            WHERE (r.value->'evidenceIds') ? (f.value->>'id')
          )
        ), '[]'::jsonb),
        'evidence', s.evidence
      )
      FROM sources s WHERE v.id=s.id
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE nodia_cv_versions IN ACCESS EXCLUSIVE MODE;
      DO $guard$ BEGIN
        IF EXISTS(SELECT 1 FROM nodia_cv_versions WHERE analysis IS NOT NULL) THEN
          RAISE EXCEPTION 'Preserve saved Nodia CV analysis before reverting';
        END IF;
      END $guard$;
      ALTER TABLE nodia_cv_versions DROP COLUMN analysis;
    `);
  }
}
