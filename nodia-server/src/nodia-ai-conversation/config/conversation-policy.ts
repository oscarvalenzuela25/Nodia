import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const NODIA_AI_CONVERSATION_POLICY = Symbol(
  'NODIA_AI_CONVERSATION_POLICY',
);
export interface NodiaAiConversationPolicy {
  readonly policyVersion: string;
  readonly policyHash: string;
  readonly retentionDays: number;
  readonly titleUtf8Bytes: number;
}

/** Build-owned asset. Never guesses a retention period when packaging is incomplete. */
export function loadNodiaAiConversationPolicy(): NodiaAiConversationPolicy {
  try {
    const envelope: unknown = JSON.parse(
      readFileSync(
        new URL('./conversation-policy.json', import.meta.url),
        'utf8',
      ),
    );
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope))
      throw Error();
    const keys = [
      'schema_version',
      'policyVersion',
      'policyHash',
      'retentionDays',
      'titleUtf8Bytes',
      'contentHash',
    ];
    if (
      Object.keys(envelope).length !== keys.length ||
      keys.some((key) => !(key in envelope))
    )
      throw Error();
    const value = envelope as Record<string, unknown>;
    if (
      value.schema_version !== 1 ||
      typeof value.policyVersion !== 'string' ||
      !/^nodia-ai-runtime\/[1-9]\d*$/.test(value.policyVersion) ||
      typeof value.policyHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(value.policyHash) ||
      !Number.isSafeInteger(value.retentionDays) ||
      Number(value.retentionDays) <= 0 ||
      !Number.isSafeInteger(value.titleUtf8Bytes) ||
      Number(value.titleUtf8Bytes) <= 0
    )
      throw Error();
    const payload = {
      schema_version: 1,
      policyVersion: value.policyVersion,
      policyHash: value.policyHash,
      retentionDays: value.retentionDays,
      titleUtf8Bytes: value.titleUtf8Bytes,
    };
    if (
      createHash('sha256').update(JSON.stringify(payload)).digest('hex') !==
      value.contentHash
    )
      throw Error();
    return Object.freeze({
      policyVersion: value.policyVersion,
      policyHash: value.policyHash,
      retentionDays: Number(value.retentionDays),
      titleUtf8Bytes: Number(value.titleUtf8Bytes),
    });
  } catch {
    throw new Error('nodia_ai_conversation_policy_unavailable');
  }
}
