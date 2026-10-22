import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { EntityManager } from 'typeorm';
import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

type RunState =
  | 'queued'
  | 'running'
  | 'waiting_for_user'
  | 'completed'
  | 'failed'
  | 'cancel_requested'
  | 'cancelled'
  | 'unknown';
type EventKind =
  | 'run_accepted'
  | 'run_changed'
  | 'message_sealed'
  | 'tool_completed'
  | 'proposal_ready';
const runStates: readonly string[] = [
  'queued',
  'running',
  'waiting_for_user',
  'completed',
  'failed',
  'cancel_requested',
  'cancelled',
  'unknown',
];
const terminalStates: readonly string[] = [
  'completed',
  'failed',
  'cancelled',
  'unknown',
];
function object(value: unknown): value is NodiaAiJsonObject {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
function keys(value: NodiaAiJsonObject, allowed: readonly string[]): boolean {
  return (
    Object.keys(value).length === allowed.length &&
    allowed.every((key) => Object.hasOwn(value, key))
  );
}
function reference(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Buffer.byteLength(value) <= 256
  );
}
function revision(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}
function safeError(value: unknown): boolean {
  return (
    value === null ||
    (object(value) &&
      keys(value, [
        'code',
        'message_key',
        'field_errors',
        'retry_action',
        'correlation_id',
      ]) &&
      typeof value.code === 'string' &&
      /^nodia_ai:[a-z0-9_]{1,100}$/.test(value.code) &&
      value.message_key === value.code &&
      Array.isArray(value.field_errors) &&
      !value.field_errors.length &&
      ['none', 'recover_status'].includes(String(value.retry_action)) &&
      reference(value.correlation_id))
  );
}
function validPayload(kind: EventKind, payload: NodiaAiJsonObject): boolean {
  if (!object(payload)) return false;
  if (kind === 'proposal_ready')
    return (
      keys(payload, ['proposal_id', 'revision', 'hash']) &&
      typeof payload.proposal_id === 'string' &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        payload.proposal_id,
      ) &&
      revision(payload.revision) &&
      typeof payload.hash === 'string' &&
      /^[a-f0-9]{64}$/.test(payload.hash)
    );
  if (kind === 'run_accepted')
    return (
      keys(payload, ['message_id', 'run_revision']) &&
      reference(payload.message_id) &&
      revision(payload.run_revision)
    );
  if (kind === 'message_sealed')
    return (
      keys(payload, ['message_id', 'status']) &&
      reference(payload.message_id) &&
      ['sealed', 'partial'].includes(String(payload.status))
    );
  if (kind === 'run_changed')
    return (
      keys(payload, ['revision', 'state', 'error']) &&
      revision(payload.revision) &&
      runStates.includes(String(payload.state)) &&
      safeError(payload.error)
    );
  if (
    kind !== 'tool_completed' ||
    !keys(payload, ['result_ref', 'state', 'error']) ||
    !object(payload.result_ref) ||
    !keys(payload.result_ref, ['tool_call_id', 'tool_name', 'contract_hash'])
  )
    return false;
  return (
    reference(payload.result_ref.tool_call_id) &&
    reference(payload.result_ref.tool_name) &&
    typeof payload.result_ref.contract_hash === 'string' &&
    /^[a-f0-9]{64}$/.test(payload.result_ref.contract_hash) &&
    ['completed', 'rejected', 'unknown'].includes(String(payload.state)) &&
    safeError(payload.error)
  );
}

/** All callers use their existing short transaction and conversation lock.
 * No cursor, delivery status, arguments, result or provider data belongs here.
 */
export async function appendNodiaAiEvent(
  manager: EntityManager,
  input: {
    conversationId: string;
    runId: string;
    eventKey: string;
    kind: EventKind;
    payload: NodiaAiJsonObject;
    moduleRoutes: readonly string[];
    maxEvents: number;
    terminal?: boolean;
  },
): Promise<void> {
  const isTerminal =
    input.kind === 'message_sealed' ||
    (input.kind === 'run_changed' &&
      terminalStates.includes(String(input.payload.state)));
  if (
    !validPayload(input.kind, input.payload) ||
    (input.terminal === true && !isTerminal)
  )
    throw new Error('nodia_ai:invalid_persisted_state');
  await appendActivityEvent(manager, {
    ...input,
    target: 'run_id',
    targetId: input.runId,
    isTerminal,
  });
}

/** Human admission and future execution transitions share the durable allocator,
 * but never reuse a model run or publish approval credentials in its payload. */
export async function appendNodiaAiExecutionEvent(
  manager: EntityManager,
  input: {
    conversationId: string;
    executionId: string;
    eventKey: string;
    payload: NodiaAiJsonObject;
    moduleRoutes: readonly string[];
    maxEvents: number;
  },
): Promise<void> {
  const states = [...runStates, 'partially_completed'];
  if (
    !object(input.payload) ||
    !keys(input.payload, ['revision', 'state', 'error']) ||
    !revision(input.payload.revision) ||
    typeof input.payload.state !== 'string' ||
    !states.includes(input.payload.state) ||
    !safeError(input.payload.error)
  )
    throw new Error('nodia_ai:invalid_persisted_state');
  await appendActivityEvent(manager, {
    ...input,
    kind: 'execution_changed',
    target: 'execution_id',
    targetId: input.executionId,
    isTerminal:
      input.payload.state === 'partially_completed' ||
      terminalStates.includes(input.payload.state),
  });
}

/** Target identifiers are private constants, never SQL identifiers from input. */
async function appendActivityEvent(
  manager: EntityManager,
  input: {
    conversationId: string;
    target: 'run_id' | 'execution_id';
    targetId: string;
    eventKey: string;
    kind: EventKind | 'execution_changed';
    payload: NodiaAiJsonObject;
    moduleRoutes: readonly string[];
    maxEvents: number;
    isTerminal: boolean;
  },
): Promise<void> {
  const publicPayload = { kind: input.kind, payload: input.payload };
  const scope = {
    schema_version: 1,
    module_routes: [...new Set(input.moduleRoutes)].sort(),
  };
  if (
    !Number.isSafeInteger(input.maxEvents) ||
    input.maxEvents < 8 ||
    !input.eventKey ||
    Buffer.byteLength(input.eventKey) > 256 ||
    Buffer.byteLength(JSON.stringify(publicPayload)) > 4096 ||
    scope.module_routes.length > 64 ||
    scope.module_routes.some(
      (route) => !route.startsWith('/') || Buffer.byteLength(route) > 256,
    )
  )
    throw new Error('nodia_ai:invalid_persisted_state');
  // Reentrant when the caller already owns this lock. It also serializes the
  // deduplication/count/sequence checks if a new producer forgets to lock first.
  const locked: { id: string }[] = await manager.query(
    'SELECT id FROM nodia_ai_conversations WHERE id=$1 FOR UPDATE',
    [input.conversationId],
  );
  if (locked.length !== 1) throw new Error('nodia_ai:invalid_persisted_state');
  const prior: {
    run_id?: string | null;
    execution_id?: string | null;
    public_payload: NodiaAiJsonObject;
    scope_manifest: NodiaAiJsonObject;
  }[] = await manager.query(
    `SELECT ${input.target},public_payload,scope_manifest FROM nodia_ai_events WHERE conversation_id=$1 AND event_key=$2`,
    [input.conversationId, input.eventKey],
  );
  if (prior.length) {
    if (
      prior.length !== 1 ||
      prior[0][input.target] !== input.targetId ||
      !isDeepStrictEqual(prior[0].public_payload, publicPayload) ||
      !isDeepStrictEqual(prior[0].scope_manifest, scope)
    )
      throw new Error('nodia_ai:request_conflict');
    return;
  }
  // Leave space for a sealed answer, terminal state, uncertain state and its
  // reconciliation. A duplicate never consumes another event or quota slot.
  const limit = input.isTerminal ? input.maxEvents : input.maxEvents - 4;
  const rows: { seq: string }[] = await manager.query(
    `WITH changed AS (UPDATE nodia_ai_conversations SET next_event_seq=next_event_seq+1
     WHERE id=$1 AND next_event_seq<9223372036854775807
     AND (SELECT count(*) FROM nodia_ai_events WHERE ${input.target}=$2)<$3
     RETURNING next_event_seq::text AS seq) SELECT seq FROM changed`,
    [input.conversationId, input.targetId, limit],
  );
  if (rows.length !== 1 || !/^[1-9][0-9]*$/.test(rows[0].seq))
    throw new Error('nodia_ai:execution_limit');
  await manager.query(
    `INSERT INTO nodia_ai_events(id,conversation_id,seq,event_key,${input.target},public_payload,scope_manifest)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
    [
      randomUUID(),
      input.conversationId,
      rows[0].seq,
      input.eventKey,
      input.targetId,
      JSON.stringify(publicPayload),
      JSON.stringify(scope),
    ],
  );
}

/** Called once after a durable public transition, in that same transaction.
 * Increment/read the current revision rather than the worker's stale claim.
 */
export async function publishNodiaAiRunChanged(
  manager: EntityManager,
  input: { conversationId: string; runId: string; maxEvents: number },
): Promise<number> {
  const rows: {
    revision: number;
    state: RunState;
    error_code: string | null;
  }[] = await manager.query(
    `WITH changed AS (UPDATE nodia_ai_runs SET revision=revision+1
       WHERE id=$1 AND conversation_id=$2 AND revision<2147483647
       RETURNING revision,state,error_code) SELECT revision,state,error_code FROM changed`,
    [input.runId, input.conversationId],
  );
  const run = rows[0];
  if (
    rows.length !== 1 ||
    !Number.isSafeInteger(run.revision) ||
    run.revision < 1 ||
    !runStates.includes(run.state) ||
    (run.error_code !== null &&
      !/^nodia_ai:[a-z0-9_]{1,100}$/.test(run.error_code))
  )
    throw new Error('nodia_ai:invalid_persisted_state');
  await appendNodiaAiEvent(manager, {
    ...input,
    eventKey: `run:${input.runId}:revision:${run.revision}`,
    kind: 'run_changed',
    payload: {
      revision: run.revision,
      state: run.state,
      error: run.error_code
        ? {
            code: run.error_code,
            message_key: run.error_code,
            field_errors: [],
            retry_action: run.state === 'unknown' ? 'recover_status' : 'none',
            correlation_id: input.runId,
          }
        : null,
    },
    moduleRoutes: [],
    terminal: terminalStates.includes(run.state),
  });
  return run.revision;
}
