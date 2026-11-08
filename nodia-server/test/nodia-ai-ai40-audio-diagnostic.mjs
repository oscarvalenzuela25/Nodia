// Operator-only projections. Never print a reply, recording, prompt or oracle.
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const sha = text => createHash('sha256').update(text).digest('hex');
const adapterCodes = new Set([
  'audio_probe_invalid', 'audio_probe_busy', 'audio_probe_unverified',
  'image_probe_invalid', 'image_probe_busy', 'image_probe_unverified',
  'mcp_probe_invalid', 'mcp_probe_busy', 'mcp_probe_unverified', 'mcp_call_invalid', 'mcp_catalog_invalid',
  'runtime_busy', 'adapter_invalid_request', 'adapter_invalid_reply', 'adapter_invalid_observation',
  'adapter_prepared_identity_invalid', 'adapter_attachments_unverified', 'operator_audio_duplicate_execute',
]);
export function safeCodexCanaryError(error) {
  const result = { name: 'Error', code: null, outcome: null };
  try {
    const response = error?.getResponse?.();
    const raw = typeof error?.code === 'string' ? error.code : typeof response?.code === 'string' ? response.code : error?.message;
    if (typeof raw === 'string' && (/^(nodia_ai:|codex_)[a-z0-9_:]{1,128}$/u.test(raw) || adapterCodes.has(raw))) result.code = raw;
    if (/^[A-Za-z0-9_]{1,64}$/u.test(error?.name ?? '')) result.name = error.name;
    if (error?.outcome === 'unknown' || error?.outcome === 'not_dispatched') result.outcome = error.outcome;
  } catch { /* Diagnostics must not replace the original exception. */ }
  return result;
}
export function audioReplyDiagnostic(text, expectedTranscript, normalize) {
  const normalized = normalize(text), expected = normalize(expectedTranscript);
  // These phrases are diagnostic matches, not a determination of account capabilities.
  const refusal = /\b(?:cannot|cant|unable to)\s+(?:hear|listen to|access|process|transcribe|interpret)\s+(?:(?:the|this|any|an?)\s+)?(?:attached\s+)?(?:audio|recording|sound)/u.test(normalized) ||
    /\bno\s+puedo\s+(?:escuchar|oir|oír|acceder|procesar|transcribir|interpretar)\b.{0,100}\b(?:audio|grabacion|grabación|sonido)/u.test(normalized) ||
    /\b(?:audio|recording|archivo de audio)\b.{0,60}\b(?:not supported|unsupported|no (?:es|está) soportado)/u.test(normalized);
  const exact = normalized === expected;
  return { text_sha256: sha(text), normalized_text_sha256: sha(normalized), text_utf8_bytes: Buffer.byteLength(text),
    normalized_words: normalized ? normalized.split(' ').length : 0, exact_oracle_match: exact,
    response_category: exact ? 'exact_transcript' : refusal ? 'explicit_audio_refusal_phrase' : 'transcript_mismatch_unclassified' };
}
export function instrumentCodexAudioRuntime(runtime, { expectedTranscript, normalize, expectedAudioSha }) {
  const own = Object.getOwnPropertyDescriptor(runtime, 'execute'), original = runtime.execute;
  if (typeof original !== 'function') throw Error('operator_runtime_execute_missing');
  const observation = { native_execute_calls: 0, original_arguments_forwarded: true, original_receiver_forwarded: true,
    original_promise_returned: false, original_reply_observed: false, original_error_preserved: false, runtime_reply_received: false };
  const wrapped = function (...args) {
    observation.native_execute_calls++;
    if (observation.native_execute_calls !== 1) throw Error('operator_audio_duplicate_execute');
    observation.original_receiver_forwarded = this === runtime;
    assert.equal(this, runtime, 'Delegate with the original runtime receiver');
    try {
      const request = args[0];
      observation.audio_count = request.audio?.length ?? 0;
      observation.image_count = request.images?.length ?? 0;
      observation.request_audio_sha256_matches = request.audio?.[0]?.sha256 === expectedAudioSha;
      observation.request_audio_media_type = request.audio?.[0]?.mediaType === 'audio/wav' ? 'audio/wav' : null;
      observation.attempt_id = request.identity?.attemptId ?? null;
    } catch { observation.projection_error = 'request_projection_failed'; }
    let promise;
    try {
      // Exactly one delegation. Argument objects, callbacks and receiver are unmodified.
      promise = Reflect.apply(original, this, args);
    } catch (error) {
      observation.runtime_error = safeCodexCanaryError(error);
      observation.original_error_preserved = true;
      throw error;
    }
    try {
      // Observe in a separate branch; never substitute the original Promise.
      promise.then(reply => {
        observation.runtime_reply_received = true;
        Object.assign(observation, audioReplyDiagnostic(reply.text, expectedTranscript, normalize), {
          terminal_proof_id: reply.terminalProof.terminalProofId,
          native_outcome: reply.terminalProof.outcome,
        });
        observation.original_reply_observed = true;
      }, error => {
        observation.runtime_error = safeCodexCanaryError(error);
        observation.original_error_preserved = true;
      }).catch(() => {
        observation.projection_error = 'reply_projection_failed';
      });
    } catch { observation.projection_error = 'promise_observation_failed'; }
    observation.original_promise_returned = true;
    return promise;
  };
  Object.defineProperty(runtime, 'execute', { configurable: true, writable: true, value: wrapped });
  return { observation, restore() {
    if (runtime.execute !== wrapped) throw Error('operator_runtime_wrapper_changed');
    if (own) Object.defineProperty(runtime, 'execute', own);
    else delete runtime.execute;
  } };
}
