import type { NodiaAiAttachment } from '../entities/nodia-ai-attachment.entity.js';

/** Closed projection; storage keys, hashes and epochs never leave the server. */
export function attachmentMetadata(row: NodiaAiAttachment) {
  return {
    attachment_id: row.id,
    conversation_id: row.conversation_id,
    kind: row.kind,
    state: row.state,
    file_name: row.file_name,
    media_type: row.media_type,
    byte_count: row.byte_count === null ? null : Number(row.byte_count),
    page_count: row.page_count,
    duration_seconds: row.duration_seconds,
    interpretation:
      row.interpretation_text === null
        ? null
        : {
            text: row.interpretation_text,
            origin: row.interpretation_origin,
            reviewed: row.interpretation_reviewed,
            revision: row.interpretation_revision,
          },
  };
}
