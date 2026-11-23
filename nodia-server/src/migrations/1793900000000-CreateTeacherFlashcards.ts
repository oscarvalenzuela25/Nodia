import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTeacherFlashcards1793900000000 implements MigrationInterface {
  name = 'CreateTeacherFlashcards1793900000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE teacher_flashcard_decks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id bigint NOT NULL REFERENCES users(id),
        title varchar(120) NOT NULL CHECK (btrim(title) <> ''),
        normalized_title varchar(160) COLLATE "C" NOT NULL CHECK (normalized_title NOT IN ('', 'general')),
        UNIQUE (owner_user_id, id),
        UNIQUE (owner_user_id, normalized_title)
      );
      CREATE TABLE teacher_flashcards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id bigint NOT NULL REFERENCES users(id),
        deck_id uuid,
        question varchar(2000) NOT NULL CHECK (btrim(question) <> ''),
        answer varchar(2000) NOT NULL CHECK (btrim(answer) <> ''),
        source jsonb CHECK (jsonb_typeof(source) = 'object'),
        image_side text CHECK (image_side IN ('question', 'answer')),
        image_bytes bytea CHECK (octet_length(image_bytes) BETWEEN 1 AND 147456),
        revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((image_bytes IS NULL) = (image_side IS NULL)),
        UNIQUE (owner_user_id, id),
        FOREIGN KEY (owner_user_id, deck_id) REFERENCES teacher_flashcard_decks(owner_user_id, id)
      );
      CREATE INDEX teacher_flashcards_owner_deck_order
        ON teacher_flashcards (owner_user_id, deck_id, created_at DESC, id DESC);
      CREATE TABLE teacher_flashcard_create_requests (
        owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        request_key uuid NOT NULL,
        card_id uuid NOT NULL,
        request_hash char(64) CHECK (request_hash ~ '^[0-9a-f]{64}$'),
        PRIMARY KEY (owner_user_id, request_key),
        UNIQUE (owner_user_id, card_id)
      );
      CREATE TABLE teacher_flashcard_reviews (
        owner_user_id bigint NOT NULL,
        card_id uuid NOT NULL,
        request_key uuid NOT NULL,
        remembered boolean NOT NULL,
        reviewed_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (owner_user_id, request_key),
        FOREIGN KEY (owner_user_id, card_id) REFERENCES teacher_flashcards(owner_user_id, id)
          ON DELETE CASCADE
      );
      CREATE INDEX teacher_flashcard_reviews_card
        ON teacher_flashcard_reviews (owner_user_id, card_id);
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      LOCK TABLE teacher_flashcard_decks, teacher_flashcards,
        teacher_flashcard_create_requests, teacher_flashcard_reviews IN ACCESS EXCLUSIVE MODE;
      DO $guard$
      BEGIN
        IF EXISTS (SELECT 1 FROM teacher_flashcard_decks)
          OR EXISTS (SELECT 1 FROM teacher_flashcards)
          OR EXISTS (SELECT 1 FROM teacher_flashcard_create_requests) THEN
          RAISE EXCEPTION 'Preserve the flashcards and their request identities before removing this migration';
        END IF;
      END $guard$;
      DROP TABLE teacher_flashcard_reviews, teacher_flashcard_create_requests,
        teacher_flashcards, teacher_flashcard_decks;
    `);
  }
}
