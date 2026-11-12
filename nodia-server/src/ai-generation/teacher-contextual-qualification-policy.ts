import { hash, uuidPattern } from '../teacher/policies/teacher-validation.js';

/** Publication trims only the reply boundary; the original anchor and its hashes stay raw. */
export function contextualQualificationReplyMatches(publishedReply: unknown, rawSelection: unknown): boolean {
  if (typeof publishedReply !== 'string' || typeof rawSelection !== 'string') return false;
  const expectedPublishedReply = rawSelection.trim();
  return expectedPublishedReply.length > 0 && publishedReply === expectedPublishedReply;
}

/** Validates the original durable probe, including historical policy hashes.
 * Eligibility for the current policy is a separate decision, never inferred here. */
export function assertContextualQualificationJob(value: unknown, jobId: string): void {
  if (!value || typeof value !== 'object') throw Error('teacher:qualification_session_required');
  const job = value as Record<string, unknown>;
  const input = job.input_snapshot as Record<string, unknown> | undefined;
  const probe = input?.qualification_probe as Record<string, unknown> | undefined;
  if (job.purpose !== 'contextual_reply' || probe?.contract !== 'teacher-contextual-probe/1'
      || probe.purpose !== 'contextual_reply' || typeof probe.nonce !== 'string' || !uuidPattern.test(probe.nonce)
      || typeof probe.teacher_policy_hash !== 'string' || !/^[0-9a-f]{64}$/.test(probe.teacher_policy_hash)
      || typeof input?.thread_id !== 'string' || !uuidPattern.test(input.thread_id)
      || typeof input.selection !== 'string' || !input.selection.length || input.selection.length > 2000
      || typeof input.visible_context !== 'string' || !input.visible_context.includes(input.selection)
      || hash({ block: input.visible_context, selection: input.selection }) !== input.anchor_hash
      || hash({ jobId, nonce: probe.nonce, purpose: 'contextual_reply', threadId: input.thread_id,
        anchorHash: input.anchor_hash }) !== job.semantic_key) throw Error('teacher:qualification_session_required');
}
