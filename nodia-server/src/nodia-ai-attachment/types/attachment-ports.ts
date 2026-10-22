export type NodiaAiAttachmentKind = 'image' | 'pdf' | 'audio';

/** Decodes in a resource-limited parser outside the API process. Never returns invented extraction. */
export abstract class NodiaAiAttachmentInspector {
  abstract inspect(input: {
    path: string;
    kind: NodiaAiAttachmentKind;
    byteCount: number;
    signal?: AbortSignal;
  }): Promise<{
    mediaType: string;
    pageCount: number | null;
    durationSeconds: number | null;
    extractedText?: string | null;
  }>;
}

/** All keys originate in the durable intent. No caller-supplied URLs or keys. */
export abstract class NodiaAiAttachmentStorage {
  abstract put(
    key: string,
    path: string,
    mediaType: string,
    signal: AbortSignal,
  ): Promise<void>;
  abstract get(
    key: string,
    maxBytes: number,
    signal: AbortSignal,
  ): Promise<Buffer>;
  abstract delete(key: string): Promise<void>;
}
