import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type {
  Flashcard,
  FlashcardCreate,
  FlashcardDeck,
  FlashcardImageSide,
  FlashcardPage,
  FlashcardPatch,
} from './types/teacher-flashcards.types.js';

export type FlashcardScope = { manager: EntityManager; owner: string };
export const FLASHCARD_PAGE_SIZE = 12;

const cardColumns = `c.id, COALESCE(c.deck_id::text, 'general') AS deck_id,
  c.question, c.answer, c.revision,
  CASE WHEN c.image_side IS NOT NULL THEN jsonb_build_object('side', c.image_side) END AS image,
  CASE WHEN c.source IS NULL THEN NULL
    WHEN c.source ? 'anchor' AND EXISTS (
      SELECT 1 FROM teacher_sessions s
      JOIN teacher_content_versions v ON v.session_id = s.id
        AND v.id = (c.source->'anchor'->>'content_version_id')::uuid
      WHERE s.id = (c.source->'anchor'->>'session_id')::uuid
        AND s.owner_user_id = c.owner_user_id
        AND NOT EXISTS (
          SELECT 1 FROM teacher_attempts a
          WHERE a.session_id = s.id AND a.scope = 'section_final' AND a.is_active
        )
    ) THEN jsonb_build_object('label', c.source->'label', 'anchor', c.source->'anchor')
    ELSE jsonb_build_object('label', c.source->'label')
  END AS source`;

@Injectable()
export class TeacherFlashcardsStore {
  decks({ manager, owner }: FlashcardScope): Promise<FlashcardDeck[]> {
    return manager.query(
      `WITH counts AS (
         SELECT deck_id, count(*)::int AS card_count FROM teacher_flashcards
         WHERE owner_user_id = $1 GROUP BY deck_id
       ), decks AS (
         SELECT 'general' AS id, 'General' AS title,
           COALESCE((SELECT card_count FROM counts WHERE deck_id IS NULL), 0) AS card_count, 0 AS ordering
         UNION ALL
         SELECT d.id::text, d.title, COALESCE(counts.card_count, 0), 1 AS ordering
         FROM teacher_flashcard_decks d LEFT JOIN counts ON counts.deck_id = d.id
         WHERE d.owner_user_id = $1
       )
       SELECT id, title, card_count FROM decks ORDER BY ordering, lower(title), id`,
      [owner],
    );
  }

  async createDeck(
    { manager, owner }: FlashcardScope,
    title: string,
    normalizedTitle: string,
  ): Promise<FlashcardDeck | undefined> {
    const [deck]: FlashcardDeck[] = await manager.query(
      `INSERT INTO teacher_flashcard_decks (owner_user_id, title, normalized_title)
       VALUES ($1, $2, $3) ON CONFLICT (owner_user_id, normalized_title) DO NOTHING
       RETURNING id, title, 0 AS card_count`,
      [owner, title, normalizedTitle],
    );
    return deck;
  }

  async hasDeck({ manager, owner }: FlashcardScope, deckId: string) {
    const [result]: { found: boolean }[] = await manager.query(
      'SELECT EXISTS (SELECT 1 FROM teacher_flashcard_decks WHERE owner_user_id = $1 AND id = $2) AS found',
      [owner, deckId],
    );
    return result.found;
  }

  async cards(
    { manager, owner }: FlashcardScope,
    deckId: string | null,
    page: number,
  ): Promise<FlashcardPage> {
    const [result]: { data: Flashcard[]; total: number }[] =
      await manager.query(
        `WITH page AS MATERIALIZED (
         SELECT id, owner_user_id, deck_id, question, answer, revision, image_side, source, created_at
         FROM teacher_flashcards
         WHERE owner_user_id = $1 AND deck_id IS NOT DISTINCT FROM $2::uuid
         ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4
       ), projected AS (
         SELECT ${cardColumns}, c.created_at FROM page c
       ) SELECT COALESCE(jsonb_agg(to_jsonb(projected) - 'created_at'
         ORDER BY created_at DESC, id DESC), '[]'::jsonb) AS data,
         (SELECT count(*)::int FROM teacher_flashcards
          WHERE owner_user_id = $1 AND deck_id IS NOT DISTINCT FROM $2::uuid) AS total
       FROM projected`,
        [owner, deckId, FLASHCARD_PAGE_SIZE, (page - 1) * FLASHCARD_PAGE_SIZE],
      );
    return {
      data: result.data,
      meta: {
        page,
        total: result.total,
        total_pages: Math.ceil(result.total / FLASHCARD_PAGE_SIZE),
      },
    };
  }

  async card(
    { manager, owner }: FlashcardScope,
    id: string,
  ): Promise<Flashcard | undefined> {
    const [card]: Flashcard[] = await manager.query(
      `SELECT ${cardColumns} FROM teacher_flashcards c WHERE c.owner_user_id = $1 AND c.id = $2`,
      [owner, id],
    );
    return card;
  }

  async image(
    { manager, owner }: FlashcardScope,
    id: string,
  ): Promise<Buffer | undefined> {
    const [image]: { image_bytes: Buffer }[] = await manager.query(
      'SELECT image_bytes FROM teacher_flashcards WHERE owner_user_id = $1 AND id = $2 AND image_bytes IS NOT NULL',
      [owner, id],
    );
    return image?.image_bytes;
  }

  lockCreation({ manager, owner }: FlashcardScope, key: string) {
    return manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`teacher-flashcard-create:${owner}:${key}`],
    );
  }

  async creation({ manager, owner }: FlashcardScope, key: string) {
    const [entry]: { card_id: string; request_hash: string | null }[] =
      await manager.query(
        'SELECT card_id, request_hash FROM teacher_flashcard_create_requests WHERE owner_user_id = $1 AND request_key = $2',
        [owner, key],
      );
    return entry;
  }

  async creationKey({ manager, owner }: FlashcardScope, id: string) {
    const [entry]: { request_key: string }[] = await manager.query(
      'SELECT request_key FROM teacher_flashcard_create_requests WHERE owner_user_id = $1 AND card_id = $2',
      [owner, id],
    );
    return entry?.request_key;
  }

  async createCard(
    { manager, owner }: FlashcardScope,
    data: FlashcardCreate,
    key: string,
    digest: string,
  ) {
    const [entry]: { card_id: string }[] = await manager.query(
      `WITH created AS (
         INSERT INTO teacher_flashcards (owner_user_id, deck_id, question, answer, source, image_side, image_bytes)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
       )
       INSERT INTO teacher_flashcard_create_requests (owner_user_id, request_key, card_id, request_hash)
         SELECT $1, $8, id, $9 FROM created RETURNING card_id`,
      [
        owner,
        data.deckId,
        data.question,
        data.answer,
        data.source,
        data.image?.side ?? null,
        data.image?.bytes ?? null,
        key,
        digest,
      ],
    );
    return entry.card_id;
  }

  async lockCard({ manager, owner }: FlashcardScope, id: string) {
    const [entry]: {
      revision: number;
      image_side: FlashcardImageSide | null;
    }[] = await manager.query(
      'SELECT revision, image_side FROM teacher_flashcards WHERE owner_user_id = $1 AND id = $2 FOR NO KEY UPDATE',
      [owner, id],
    );
    return entry;
  }

  async patchCard(
    { manager, owner }: FlashcardScope,
    id: string,
    data: FlashcardPatch,
  ) {
    const changedSide =
      data.image !== undefined || data.imageSide !== undefined;
    const [row]: { id: string }[] = await manager.query(
      `WITH updated AS (
        UPDATE teacher_flashcards SET question = COALESCE($4, question), answer = COALESCE($5, answer),
          deck_id = CASE WHEN $6 THEN $7::uuid ELSE deck_id END,
          source = CASE WHEN $8 THEN $9::jsonb ELSE source END,
          image_bytes = CASE WHEN $10 THEN $11::bytea ELSE image_bytes END,
          image_side = CASE WHEN $12 THEN $13::text ELSE image_side END,
          revision = revision + 1
        WHERE owner_user_id = $1 AND id = $2 AND revision = $3 RETURNING id
       ) SELECT id FROM updated`,
      [
        owner,
        id,
        data.revision,
        data.question ?? null,
        data.answer ?? null,
        data.deckId !== undefined,
        data.deckId ?? null,
        data.source !== undefined,
        data.source ?? null,
        data.image !== undefined,
        data.image?.bytes ?? null,
        changedSide,
        data.image?.side ?? data.imageSide ?? null,
      ],
    );
    return Boolean(row);
  }

  async deleteCard({ manager, owner }: FlashcardScope, id: string) {
    await manager.query(
      `WITH deleted AS (
        DELETE FROM teacher_flashcards WHERE owner_user_id = $1 AND id = $2 RETURNING id
       ) UPDATE teacher_flashcard_create_requests r SET request_hash = NULL
         FROM deleted WHERE r.owner_user_id = $1 AND r.card_id = deleted.id`,
      [owner, id],
    );
  }

  async lockReviewCard({ manager, owner }: FlashcardScope, id: string) {
    const [card]: { id: string }[] = await manager.query(
      'SELECT id FROM teacher_flashcards WHERE owner_user_id = $1 AND id = $2 FOR KEY SHARE',
      [owner, id],
    );
    return Boolean(card);
  }

  async remember(
    { manager, owner }: FlashcardScope,
    cardId: string,
    requestKey: string,
    remembered: boolean,
  ) {
    const [result]: { card_id: string }[] = await manager.query(
      `INSERT INTO teacher_flashcard_reviews (owner_user_id, card_id, request_key, remembered)
       VALUES ($1, $2, $3, $4) ON CONFLICT (owner_user_id, request_key) DO NOTHING RETURNING card_id`,
      [owner, cardId, requestKey, remembered],
    );
    if (result) return true;
    const [previous]: { card_id: string; remembered: boolean }[] =
      await manager.query(
        'SELECT card_id, remembered FROM teacher_flashcard_reviews WHERE owner_user_id = $1 AND request_key = $2',
        [owner, requestKey],
      );
    return previous?.card_id === cardId && previous.remembered === remembered;
  }
}
