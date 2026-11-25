import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNodiaCvDraftReviews1793990000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE nodia_cv_generations
        ADD COLUMN review jsonb,
        ADD COLUMN review_revision integer,
        ADD COLUMN review_updated_by_actor_id bigint;

      UPDATE nodia_cv_generations g
      SET review_revision=1,
        review=jsonb_build_object(
          'included_fact_ids', COALESCE(
            (SELECT jsonb_agg(fact->>'id' ORDER BY ordinal)
             FROM jsonb_array_elements(g.draft->'selectedFacts') WITH ORDINALITY AS f(fact,ordinal)),
            '[]'::jsonb),
          'evidence', '[]'::jsonb
        )
      WHERE g.state='ready';

      ALTER TABLE nodia_cv_generations ADD CONSTRAINT ck_nodia_cv_draft_review
        CHECK (
          (state<>'ready' AND review IS NULL AND review_revision IS NULL AND review_updated_by_actor_id IS NULL)
          OR
          (state='ready' AND review IS NOT NULL AND jsonb_typeof(review)='object'
            AND octet_length(review::text)<=196608 AND review_revision IS NOT NULL
            AND (
              (review_revision=1 AND review_updated_by_actor_id IS NULL)
              OR
              (review_revision>1 AND review_updated_by_actor_id IS NOT NULL AND review_updated_by_actor_id=owner_user_id)
            )
          )
        );
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE nodia_cv_generations IN ACCESS EXCLUSIVE MODE;
      DO $guard$ BEGIN
        IF EXISTS(SELECT 1 FROM nodia_cv_generations WHERE review_revision>1) THEN
          RAISE EXCEPTION 'Preserve edited Nodia CV draft reviews before reverting';
        END IF;
      END $guard$;
      ALTER TABLE nodia_cv_generations DROP CONSTRAINT ck_nodia_cv_draft_review,
        DROP COLUMN review_updated_by_actor_id, DROP COLUMN review_revision, DROP COLUMN review;
    `);
  }
}
