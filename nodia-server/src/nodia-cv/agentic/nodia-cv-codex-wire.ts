import {
  agenticHash,
  agenticHex,
  agenticTextHash,
  agenticUuid,
  agenticWellFormedText,
} from '../../ai-generation/agentic-text-contract.js';
import { parseNodiaAiStrictJson } from '../../nodia-ai-context/strict-json.js';

export const CV_CODEX_HOST_MAX_TERMINAL_FRAME_BYTES = 262_144;
const MAX_REQUEST_FRAME_BYTES = 800_000;
export const CV_CODEX_HOST_MAX_PROMPT_BYTES = 131_072;
const MAX_RESULT_BYTES = 32_768;
const MAX_DEADLINE_MS = 600_000;

export interface CvCodexHostRequest {
  readonly operation_id: string;
  readonly model_id: string;
  readonly effort_id: string | null;
  readonly prompt: string;
  readonly deadline_at: string;
  readonly configuration_generation: string;
  readonly session_generation: string;
  readonly resource_key: string;
}

export type CvCodexHostResult =
  | { readonly outcome: 'completed'; readonly text: string }
  | { readonly outcome: 'not_dispatched' | 'unknown'; readonly text: null };

const REQUEST_KEYS = [
  'operation_id',
  'model_id',
  'effort_id',
  'prompt',
  'deadline_at',
  'configuration_generation',
  'session_generation',
  'resource_key',
];
const START_KEYS = [
  'event',
  'operation_id',
  'binding_hash',
  'proof_nonce',
  'policy_hash',
];
const COMPLETED_KEYS = [
  'event',
  'status',
  'binding_hash',
  'proof_nonce',
  'text',
  'text_hash',
  'local_closed',
  'remote_outcome',
];
const ERROR_KEYS = [
  'event',
  'status',
  'code',
  'binding_hash',
  'local_closed',
  'remote_outcome',
  'retry',
];
const ARMED_ERROR_KEYS = [...ERROR_KEYS, 'proof_nonce'];

// These errors can be emitted by main.rs before the host arms its one-shot request.
const PRE_DISPATCH_CODES = new Set([
  'invalid_arguments',
  'invalid_configuration',
  'profile_unavailable',
  'invalid_workspace',
  'invalid_input',
  'input_too_large',
  'invalid_deadline',
  'native_unavailable',
  'native_not_compiled',
  'deadline_exceeded',
  'invalid_effort',
  'selection_changed',
]);

const invalid = () => new Error('cv:codex_host_protocol_invalid');

function hasKeys(frame: object, keys: readonly string[]): boolean {
  return (
    Object.keys(frame).length === keys.length &&
    keys.every((key) => Object.hasOwn(frame, key))
  );
}

function boundedText(value: unknown, maxBytes: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    Buffer.byteLength(value, 'utf8') <= maxBytes &&
    agenticWellFormedText(value)
  );
}

function boundedId(value: unknown, maxBytes: number): value is string {
  return (
    boundedText(value, maxBytes) &&
    value === value.trim() &&
    !/\p{Cc}/u.test(value)
  );
}

function parseFrame(line: string): Record<string, unknown> {
  if (
    !boundedText(line, CV_CODEX_HOST_MAX_TERMINAL_FRAME_BYTES) ||
    line.includes('\n') ||
    line.includes('\r')
  )
    throw invalid();
  const frame = parseNodiaAiStrictJson(line);
  if (frame === null || typeof frame !== 'object' || Array.isArray(frame))
    throw invalid();
  return frame as Record<string, unknown>;
}

/**
 * Implements the native host's private, one-shot wire contract. The caller must
 * verify the child and its process group have closed before issuing a receipt.
 */
export function createCvCodexHostWire(
  request: CvCodexHostRequest,
  policyHash: string,
  sourceCommit: string,
) {
  const remaining = Date.parse(request.deadline_at) - Date.now();
  if (
    !hasKeys(request, REQUEST_KEYS) ||
    !agenticUuid(request.operation_id) ||
    !boundedId(request.model_id, 1024) ||
    (request.effort_id !== null && !boundedId(request.effort_id, 256)) ||
    !boundedText(request.prompt, CV_CODEX_HOST_MAX_PROMPT_BYTES) ||
    !boundedId(request.configuration_generation, 256) ||
    !boundedId(request.session_generation, 256) ||
    !boundedId(request.resource_key, 256) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      request.deadline_at,
    ) ||
    !(remaining > 0 && remaining <= MAX_DEADLINE_MS) ||
    !agenticHex(policyHash) ||
    !agenticHex(sourceCommit, 40)
  )
    throw invalid();

  const operationId = request.operation_id;
  const { prompt, ...reference } = request;
  const input = JSON.stringify({ ...reference, prompt }) + '\n';
  if (Buffer.byteLength(input, 'utf8') > MAX_REQUEST_FRAME_BYTES)
    throw invalid();
  const binding = agenticHash({
    ...reference,
    policy_hash: policyHash,
    prompt_hash: agenticTextHash(prompt),
    source_commit: sourceCommit,
  });
  let nonce: string | null = null;
  let terminal: CvCodexHostResult | null = null;
  let poisoned = false;

  function accept(line: string): boolean {
    try {
      if (poisoned || terminal) throw invalid();
      const frame = parseFrame(line);
      if (frame.event === 'started') {
        if (
          nonce !== null ||
          !hasKeys(frame, START_KEYS) ||
          frame.operation_id !== operationId ||
          frame.binding_hash !== binding ||
          frame.policy_hash !== policyHash ||
          !agenticUuid(frame.proof_nonce)
        )
          throw invalid();
        nonce = frame.proof_nonce;
        return false;
      }
      if (frame.event !== 'terminal') throw invalid();
      if (frame.status === 'completed') {
        if (
          !hasKeys(frame, COMPLETED_KEYS) ||
          nonce === null ||
          frame.proof_nonce !== nonce ||
          frame.binding_hash !== binding ||
          frame.local_closed !== true ||
          frame.remote_outcome !== 'completed' ||
          !boundedText(frame.text, MAX_RESULT_BYTES) ||
          frame.text_hash !== agenticTextHash(frame.text)
        )
          throw invalid();
        terminal = { outcome: 'completed', text: frame.text };
      } else {
        if (
          frame.status !== 'error' ||
          frame.retry !== false ||
          typeof frame.code !== 'string' ||
          !/^[a-z_]{1,100}$/.test(frame.code) ||
          typeof frame.local_closed !== 'boolean'
        )
          throw invalid();
        if (nonce === null) {
          if (
            !hasKeys(frame, ERROR_KEYS) ||
            frame.binding_hash !== null ||
            frame.local_closed !== true ||
            frame.remote_outcome !== 'not_dispatched' ||
            !PRE_DISPATCH_CODES.has(frame.code)
          )
            throw invalid();
          terminal = { outcome: 'not_dispatched', text: null };
        } else {
          if (
            !hasKeys(frame, ARMED_ERROR_KEYS) ||
            frame.proof_nonce !== nonce ||
            frame.binding_hash !== binding ||
            frame.remote_outcome !== 'unknown'
          )
            throw invalid();
          terminal = { outcome: 'unknown', text: null };
        }
      }
      return true;
    } catch {
      poisoned = true;
      throw invalid();
    }
  }

  return {
    input,
    accept,
    finish(): CvCodexHostResult {
      if (poisoned || !terminal) throw invalid();
      return terminal;
    },
  };
}
