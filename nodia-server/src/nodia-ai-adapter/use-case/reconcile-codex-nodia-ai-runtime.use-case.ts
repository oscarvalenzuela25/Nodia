import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CodexChatRuntime } from '../../common/ai/codex/codex-chat-runtime.js';
import { CodexChatReceiptAbsentError } from '../../common/ai/codex/codex-chat-contract.js';
import {
  NodiaAiRuntimeReconciliationPort,
  type NodiaAiCodexRuntimeProofRequest,
  type NodiaAiRuntimeProofRequest,
  type NodiaAiRuntimeTerminalProof,
} from '../../nodia-ai-runtime/types/reconciliation.types.js';
import {
  assertRuntimeTerminalProof,
  readRuntimeProofRequest,
  readTerminalProof,
  runtimeProofDescriptor,
} from '../../nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js';

function identity(
  request: NodiaAiRuntimeProofRequest,
): NodiaAiCodexRuntimeProofRequest {
  const normalized = readRuntimeProofRequest(runtimeProofDescriptor(request));
  if (normalized.engine !== 'agentic' || !normalized.adapterIdentity)
    throw Error('nodia_ai:invalid_reconciliation');
  Object.freeze(normalized.adapterIdentity);
  Object.freeze(normalized);
  return normalized;
}
@Injectable()
export class ReconcileCodexNodiaAiRuntimeUseCase extends NodiaAiRuntimeReconciliationPort {
  constructor(
    private readonly runtime: CodexChatRuntime,
    private readonly source: DataSource,
  ) {
    super();
  }
  async reconcile(
    request: NodiaAiRuntimeProofRequest,
    signal: AbortSignal,
  ): Promise<NodiaAiRuntimeTerminalProof> {
    const expected = identity(request);
    const proof = await this.runtime.reconcile(expected, signal);
    assertRuntimeTerminalProof(expected, proof);
    if (proof.observedAt.getTime() > Date.now() + 5000)
      throw Error('nodia_ai:invalid_terminal_proof');
    return proof;
  }
  async acknowledge(
    proof: NodiaAiRuntimeTerminalProof,
    signal: AbortSignal,
  ): Promise<void> {
    const expected = identity(proof);
    assertRuntimeTerminalProof(expected, proof);
    if (proof.observedAt.getTime() > Date.now() + 5000)
      throw Error('nodia_ai:invalid_terminal_proof');
    const snapshot: NodiaAiRuntimeTerminalProof = Object.freeze({
      ...expected,
      terminalProofId: proof.terminalProofId,
      processClosed: true,
      outcome: proof.outcome,
      observedAt: new Date(proof.observedAt),
    });
    try {
      await this.runtime.acknowledge(snapshot, signal);
    } catch (error) {
      if (!(error instanceof CodexChatReceiptAbsentError)) throw error;
      // A lost native ACK response/SQL commit may outlive the pruned receipt.
      // Absence never attests closure. Only the exact, already verified proof in
      // a currently leased SQL cleanup job can authorize idempotent cleanup.
      await this.verifyPersistedCleanup(snapshot, signal);
    }
  }

  private async verifyPersistedCleanup(
    proof: NodiaAiRuntimeTerminalProof,
    signal: AbortSignal,
  ): Promise<void> {
    signal.throwIfAborted();
    const rows: unknown = await this.source.manager.query(
      `SELECT id::text,kind,stage_key,state,lease_owner::text,
       lease_until>clock_timestamp() AS lease_live,recovery_descriptor
       FROM nodia_ai_jobs
       WHERE kind='reconcile' AND stage_key='reconcile_ack' AND state='leased'
       AND lease_owner IS NOT NULL AND lease_until>clock_timestamp()
       AND recovery_descriptor->'runtime'->>'attempt_id'=$1
       AND recovery_descriptor->'terminal_proof'->>'id'=$2 LIMIT 2`,
      [proof.attemptId, proof.terminalProofId],
    );
    signal.throwIfAborted();
    const row =
      Array.isArray(rows) &&
      rows.length === 1 &&
      rows[0] !== null &&
      typeof rows[0] === 'object' &&
      !Array.isArray(rows[0])
        ? (rows[0] as Record<string, unknown>)
        : null;
    const uuid =
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (
      !row ||
      typeof row.id !== 'string' ||
      !uuid.test(row.id) ||
      row.kind !== 'reconcile' ||
      row.stage_key !== 'reconcile_ack' ||
      row.state !== 'leased' ||
      typeof row.lease_owner !== 'string' ||
      !uuid.test(row.lease_owner) ||
      row.lease_live !== true
    )
      throw Error('nodia_ai:reconciliation_cleanup_pending');
    const persisted = readTerminalProof(row.recovery_descriptor);
    assertRuntimeTerminalProof(proof, persisted);
    if (
      persisted.terminalProofId !== proof.terminalProofId ||
      persisted.outcome !== proof.outcome ||
      persisted.observedAt.getTime() !== proof.observedAt.getTime()
    )
      throw Error('nodia_ai:invalid_terminal_proof');
    // Deliberately no slot mutation: another generation may already own it.
  }
}
