import { createHash } from 'node:crypto';
import type { AiSelection } from './ai-selection.js';

export const TEACHER_AGENTIC_CONTRACT = 'teacher-agentic-text/1' as const;
export const CODEX_TEACHER_TEXT_TRANSPORT = Symbol('CODEX_TEACHER_TEXT_TRANSPORT');
export type TeacherAgenticProvider = 'openai' | 'gemini';
export interface TeacherAgenticObservation {
  contract: typeof TEACHER_AGENTIC_CONTRACT;
  available: boolean;
  reason: string | null;
  observed_at: string;
  resource_key: string | null;
  session_generation: string;
  runtime_hash: string;
  binary_sha512: string | null;
  policy_hash: string;
  tool_policy: 'none' | 'finish_only';
  native_io: false;
}
export interface TeacherAgenticReference {
  contract: typeof TEACHER_AGENTIC_CONTRACT;
  operation_id: string;
  session_id: string;
  job_id: string;
  attempt_id: string;
  actor_id: string;
  connection_id: string;
  model_id: string;
  effort_id: string | null;
  resource_key: string;
  configuration_generation: string;
  session_generation: string;
  runtime_hash: string;
  policy_hash: string;
  request_hash: string;
}
export interface TeacherAgenticCommand extends TeacherAgenticReference {
  prompt: string;
  deadline_at: string;
}
export interface TeacherAgenticProof extends TeacherAgenticReference {
  terminal_proof_id: string;
  process_closed: true;
  remote_outcome: 'completed' | 'unknown';
  response_hash: string | null;
  observed_at: string;
}
export interface TeacherAgenticSnapshot {
  contract: typeof TEACHER_AGENTIC_CONTRACT;
  operation_id: string;
  state: 'running' | 'completed' | 'unknown';
  text: string | null;
  terminal_proof: TeacherAgenticProof | null;
}
export interface TeacherAgenticDescriptor {
  provider: TeacherAgenticProvider;
  reference: TeacherAgenticReference;
}
export interface TeacherAgenticConfiguration {
  providerKey: TeacherAgenticProvider;
  connectionId: string;
  keyId: null;
  configurationGeneration: string;
  sessionGeneration: string;
  resourceKey: string;
  agentic: TeacherAgenticObservation;
}
export interface TeacherAgenticTransport {
  observe(selection: AiSelection, configurationGeneration: string, signal: AbortSignal): Promise<TeacherAgenticObservation>;
  start(command: TeacherAgenticCommand, signal: AbortSignal): Promise<TeacherAgenticSnapshot>;
  status(reference: TeacherAgenticReference, signal: AbortSignal): Promise<TeacherAgenticSnapshot>;
  reconcile(reference: TeacherAgenticReference, signal: AbortSignal): Promise<TeacherAgenticSnapshot>;
  acknowledge(reference: TeacherAgenticReference, proof: TeacherAgenticProof, signal: AbortSignal): Promise<void>;
}

export function agenticCanonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(agenticCanonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => [key, agenticCanonical(item)]));
  return value;
}
export const agenticHash = (value: unknown): string => createHash('sha256').update(JSON.stringify(agenticCanonical(value))).digest('hex');
export const agenticTextHash = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
export const agenticWellFormedText = (value: string): boolean => Buffer.from(value, 'utf8').toString('utf8') === value;
export function agenticRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw Error('teacher:agentic_protocol_invalid');
  return value as Record<string, unknown>;
}
function keys(record: Record<string, unknown>, expected: readonly string[]): void {
  if (Object.keys(record).length !== expected.length || expected.some(key => !Object.hasOwn(record, key))) throw Error('teacher:agentic_protocol_invalid');
}
export const agenticHex = (value: unknown, length = 64): value is string => typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
export const agenticUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value) && value !== '00000000-0000-0000-0000-000000000000';
const instant = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
export function parseTeacherAgenticObservation(value: unknown, provider: TeacherAgenticProvider): TeacherAgenticObservation {
  const v = agenticRecord(value);
  keys(v, ['contract', 'available', 'reason', 'observed_at', 'resource_key', 'session_generation', 'runtime_hash', 'binary_sha512', 'policy_hash', 'tool_policy', 'native_io']);
  const prefix = provider === 'openai' ? 'codex-profile:' : 'gemini-profile:';
  if (v.contract !== TEACHER_AGENTIC_CONTRACT || typeof v.available !== 'boolean' || !(v.reason === null || typeof v.reason === 'string' && /^[a-z_]{1,100}$/.test(v.reason)) || !instant(v.observed_at) ||
      !(v.resource_key === null || typeof v.resource_key === 'string' && v.resource_key.startsWith(prefix) && agenticHex(v.resource_key.slice(prefix.length))) ||
      !agenticHex(v.session_generation, 32) || !agenticHex(v.runtime_hash) || !agenticHex(v.policy_hash) || !(v.binary_sha512 === null || agenticHex(v.binary_sha512, 128)) ||
      v.native_io !== false || v.tool_policy !== (provider === 'openai' ? 'none' : 'finish_only') || (v.available && (!v.resource_key || !v.binary_sha512 || v.reason !== null))) throw Error('teacher:agentic_protocol_invalid');
  return v as unknown as TeacherAgenticObservation;
}
export function teacherAgenticReference(command: TeacherAgenticCommand): TeacherAgenticReference {
  const { prompt: _prompt, deadline_at: _deadline, ...reference } = command;
  return reference;
}
export function parseTeacherAgenticProof(value: unknown, reference: TeacherAgenticReference): TeacherAgenticProof {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 8192) throw Error('teacher:agentic_protocol_invalid');
  const v = agenticRecord(value);
  keys(v, [...Object.keys(reference), 'terminal_proof_id', 'process_closed', 'remote_outcome', 'response_hash', 'observed_at']);
  if (Object.entries(reference).some(([key, item]) => v[key] !== item) || !agenticUuid(v.terminal_proof_id) || v.process_closed !== true ||
      !['completed', 'unknown'].includes(String(v.remote_outcome)) || !(v.response_hash === null || agenticHex(v.response_hash)) || !instant(v.observed_at) ||
      (v.remote_outcome === 'completed' && !v.response_hash)) throw Error('teacher:agentic_protocol_invalid');
  return v as unknown as TeacherAgenticProof;
}
export function parseTeacherAgenticSnapshot(value: unknown, reference: TeacherAgenticReference): TeacherAgenticSnapshot {
  const v = agenticRecord(value);
  keys(v, ['contract', 'operation_id', 'state', 'text', 'terminal_proof']);
  if (v.contract !== TEACHER_AGENTIC_CONTRACT || v.operation_id !== reference.operation_id || !['running', 'completed', 'unknown'].includes(String(v.state)) ||
      !(v.text === null || typeof v.text === 'string' && v.text.trim().length > 0 && agenticWellFormedText(v.text) && Buffer.byteLength(v.text, 'utf8') <= 32768)) throw Error('teacher:agentic_protocol_invalid');
  const proof = v.terminal_proof === null ? null : parseTeacherAgenticProof(v.terminal_proof, reference);
  if (v.state === 'running' && (proof || v.text !== null) || v.state === 'unknown' && v.text !== null || v.state === 'completed' && (!proof || proof.remote_outcome !== 'completed') ||
      v.text !== null && (!proof || proof.remote_outcome !== 'completed' || proof.response_hash !== agenticTextHash(v.text as string))) throw Error('teacher:agentic_protocol_invalid');
  return { ...v, terminal_proof: proof } as unknown as TeacherAgenticSnapshot;
}

/** Missing native closure is a durable exclusion, never an API-reader closure proof. */
export class TeacherAgenticUnclosedError extends Error {
  constructor(readonly descriptor: TeacherAgenticDescriptor) { super('teacher:local_closure_unproven'); }
}
export class TeacherAgenticClosedError extends Error {
  constructor(readonly descriptor: TeacherAgenticDescriptor | null, readonly proof: TeacherAgenticProof | null, readonly notStarted: boolean, code = 'provider_outcome_unknown') { super(`teacher:${code}`); }
}
