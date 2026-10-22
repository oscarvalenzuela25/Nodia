import type { MigrationInterface, QueryRunner } from 'typeorm';

/** M3: one durable intent per immutable object generation; no transcript or upload ledger table. */
export class CreateNodiaAiAttachments1792800000000 implements MigrationInterface {
  name = 'CreateNodiaAiAttachments1792800000000';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      CREATE TABLE nodia_ai_attachments (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES nodia_ai_conversations(id) ON DELETE CASCADE,
        client_request_id uuid NOT NULL,
        request_hash char(64) NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
        retention_epoch bigint NOT NULL CHECK(retention_epoch>0),
        kind text NOT NULL CHECK(kind IN ('image','pdf','audio')),
        state text NOT NULL CHECK(state IN ('uploading','ready','rejected','expired')),
        file_name text NOT NULL CHECK(octet_length(file_name) BETWEEN 1 AND 256 AND file_name !~ '[[:cntrl:]/\\\\]'),
        storage_key text NOT NULL UNIQUE CHECK(storage_key ~ '^nodia-ai/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
        generation uuid NOT NULL UNIQUE,
        reserved_bytes bigint NOT NULL CHECK(reserved_bytes BETWEEN 1 AND 20971520),
        byte_count bigint CHECK(byte_count BETWEEN 1 AND reserved_bytes),
        media_type text CHECK(media_type IN ('image/jpeg','image/png','image/webp','application/pdf','audio/wav','audio/mpeg','audio/ogg','audio/webm','audio/mp4')),
        content_hash char(64) CHECK(content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$'),
        page_count integer CHECK(page_count BETWEEN 1 AND 100),
        duration_seconds double precision CHECK(duration_seconds>0 AND duration_seconds<=300 AND duration_seconds<>'NaN'::float8),
        interpretation_text text CHECK(octet_length(interpretation_text) BETWEEN 1 AND 32768),
        interpretation_revision integer NOT NULL DEFAULT 0 CHECK(interpretation_revision>=0),
        interpretation_reviewed boolean NOT NULL DEFAULT false,
        interpretation_origin text CHECK(interpretation_origin IN ('user_reviewed','provider','extracted')),
        expires_at timestamptz NOT NULL,
        processing_started_at timestamptz,
        write_until_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(conversation_id,client_request_id),
        UNIQUE(conversation_id,id),
        CHECK((state<>'ready') OR (byte_count IS NOT NULL AND media_type IS NOT NULL AND content_hash IS NOT NULL)),
        CHECK((interpretation_text IS NULL AND interpretation_origin IS NULL AND interpretation_revision=0 AND NOT interpretation_reviewed)
          OR (interpretation_text IS NOT NULL AND interpretation_origin IS NOT NULL AND interpretation_revision>0)),
        CHECK((processing_started_at IS NULL)=(write_until_at IS NULL)),
        CHECK(page_count IS NULL OR kind='pdf'),
        CHECK(duration_seconds IS NULL OR kind='audio')
      );
      CREATE INDEX ix_nodia_ai_attachment_pending ON nodia_ai_attachments(expires_at,id) WHERE state='uploading';
      ALTER TABLE nodia_ai_message_parts ALTER COLUMN text DROP NOT NULL;
      ALTER TABLE nodia_ai_message_parts ADD COLUMN attachment_id uuid;
      ALTER TABLE nodia_ai_message_parts DROP CONSTRAINT nodia_ai_message_parts_kind_check;
      ALTER TABLE nodia_ai_message_parts DROP CONSTRAINT nodia_ai_message_parts_text_check;
      ALTER TABLE nodia_ai_message_parts ADD CONSTRAINT ck_nodia_ai_message_part_payload CHECK(
        (kind='text' AND text IS NOT NULL AND octet_length(text) BETWEEN 1 AND 32768 AND attachment_id IS NULL)
        OR (kind IN ('image','pdf','audio') AND (text IS NULL OR octet_length(text) BETWEEN 1 AND 32768) AND attachment_id IS NOT NULL));
      ALTER TABLE nodia_ai_message_parts ADD CONSTRAINT fk_nodia_ai_message_part_attachment
        FOREIGN KEY(conversation_id,attachment_id) REFERENCES nodia_ai_attachments(conversation_id,id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED;
      CREATE INDEX ix_nodia_ai_message_part_attachment ON nodia_ai_message_parts(attachment_id) WHERE attachment_id IS NOT NULL;
    `);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      DO $$ BEGIN IF EXISTS(SELECT 1 FROM nodia_ai_attachments) THEN
        RAISE EXCEPTION 'Attachment data must be explicitly reconciled before rollback'; END IF; END $$;
      DROP INDEX ix_nodia_ai_message_part_attachment;
      ALTER TABLE nodia_ai_message_parts DROP CONSTRAINT fk_nodia_ai_message_part_attachment;
      ALTER TABLE nodia_ai_message_parts DROP CONSTRAINT ck_nodia_ai_message_part_payload;
      ALTER TABLE nodia_ai_message_parts DROP COLUMN attachment_id;
      ALTER TABLE nodia_ai_message_parts ALTER COLUMN text SET NOT NULL;
      ALTER TABLE nodia_ai_message_parts ADD CONSTRAINT nodia_ai_message_parts_kind_check CHECK(kind='text');
      ALTER TABLE nodia_ai_message_parts ADD CONSTRAINT nodia_ai_message_parts_text_check CHECK(octet_length(text) BETWEEN 1 AND 32768);
      DROP TABLE nodia_ai_attachments;
    `);
  }
}
