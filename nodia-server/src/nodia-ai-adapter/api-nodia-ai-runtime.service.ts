import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, type EntityManager } from 'typeorm';
import type { NodiaAiAdapterRequest, NodiaAiGeneratedImage } from './types/nodia-ai-adapter.types.js';
import type {
  NodiaAiApiRuntimeProofRequest,
  NodiaAiApiRuntimeTerminalProof,
  NodiaAiRuntimeProofRequest,
  NodiaAiRuntimeTerminalProof,
} from '../nodia-ai-runtime/types/reconciliation.types.js';
import {
  assertRuntimeTerminalProof, readRuntimeProofRequest, readTerminalProof,
  runtimeProofDescriptor, terminalRuntimeProofDescriptor,
} from '../nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js';
import { API_EXECUTOR_OWNER, isApiExecutorProvenClosed } from './api-nodia-ai-runtime-owner.js';
import { lockNodiaAiQueue } from '../nodia-ai-runtime/queue-lock.js';
import { hasGenerationBridge,finishChatGeneration } from '../ai-generation/chat-generation-ownership.js';
import type { NodiaAiApiConfiguration } from './api-nodia-ai-credentials.service.js';

interface DispatchRow {
  attempt_id: string;
  identity: unknown;
  request_hash: string;
  response_hash: string | null;
  owner_machine: string;
  owner_boot: string;
  owner_pid: number;
  owner_birth: string;
  owner_instance: string;
  state: 'running' | 'closed';
  exchange_count: number;
  terminal_proof: unknown;
}
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function apiReplyDigest(result: { text: string; generatedImage?: NodiaAiGeneratedImage }): string {
  return digest(JSON.stringify({ text: result.text, image: result.generatedImage
    ? [result.generatedImage.mediaType, result.generatedImage.sha256, digest(result.generatedImage.contentBase64)] : null }));
}
function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw Error('nodia_ai:' + code);
}

/** Durable local HTTP ownership. Provider outcomes remain unknown after lost responses. */
@Injectable()
export class ApiNodiaAiRuntimeService {
  private readonly active = new Map<string, string>();
  private readonly locallyClosed = new Map<string, { hash: string; outcome: 'completed' | 'unknown'; responseHash?: string }>();

  constructor(private readonly source: DataSource) {}

  private requestHash(request: NodiaAiAdapterRequest): string {
    return digest(JSON.stringify({
      attempt: request.attemptId,
      selection: [request.selection.connection_id, request.selection.mode, request.selection.model_id, request.selection.effort_id],
      resource: request.resourceKey, session: request.sessionGeneration,
      configuration: request.configurationGeneration, deadline: request.deadlineAt.toISOString(),
      prompt: digest(request.canonicalPrompt),
      attachments: request.attachments?.map(item => [item.kind, item.media_type, item.sha256, digest(item.content_base64)]) ?? [],
      image: request.imageGeneration ? digest(request.imageGeneration.prompt) : null,
      tools: request.tools?.map(tool => [tool.name, digest(tool.description), digest(JSON.stringify(tool.inputSchema))]) ?? [],
    }));
  }

  private async armed(manager: EntityManager, request: NodiaAiAdapterRequest): Promise<NodiaAiApiRuntimeProofRequest> {
    const rows: { descriptor: unknown; configuration: unknown; active: boolean; selection: unknown; deadline: Date }[] = await manager.query(
      `SELECT j.recovery_descriptor AS descriptor,r.context_manifest->>'configuration_generation' AS configuration,
         a.selection_snapshot AS selection,j.deadline_at AS deadline,
         (j.state='leased' AND a.phase='dispatch_armed' AND a.ended_at IS NULL
          AND j.lease_owner=a.worker_id AND j.fence=a.fence AND j.lease_until>clock_timestamp()
          AND s.state='held' AND s.job_id=j.id AND s.holder_worker_id=a.worker_id
          AND s.fence=a.runtime_fence AND s.lease_until>clock_timestamp()
          AND s.external_operation_ref=a.external_operation_ref AND a.external_operation_ref=a.id::text) AS active
       FROM nodia_ai_job_attempts a JOIN nodia_ai_jobs j ON j.id=a.job_id
       JOIN nodia_ai_runs r ON r.id=j.run_id
       JOIN nodia_ai_runtime_slots s ON s.resource_key=a.runtime_resource_key
       WHERE a.id=$1 FOR UPDATE OF j,a,s,r`, [request.attemptId],
    );
    const row = rows[0];
    assert(rows.length === 1 && row.active === true, 'lease_lost');
    const identity = readRuntimeProofRequest(row.descriptor);
    assert(identity.engine === 'api_key', 'invalid_terminal_proof');
    const selection = row.selection as NodiaAiAdapterRequest['selection'] | null;
    assert(selection && selection.mode === 'api_key'
      && selection.connection_id === request.selection.connection_id
      && selection.model_id === request.selection.model_id && selection.effort_id === request.selection.effort_id
      && request.selection.mode === 'api_key'
      && identity.adapterIdentity.connectionId === selection.connection_id
      && identity.attemptId === request.attemptId && identity.operationRef === request.attemptId
      && identity.resourceKey === request.resourceKey && identity.sessionGeneration === request.sessionGeneration
      && row.configuration === request.configurationGeneration
      && Number.isFinite(request.deadlineAt.getTime()) && request.deadlineAt.getTime() > Date.now()
      && request.deadlineAt.getTime() <= new Date(row.deadline).getTime(), 'eligibility_changed');
    return identity;
  }

  async start(request: NodiaAiAdapterRequest,configuration?:NodiaAiApiConfiguration): Promise<NodiaAiApiRuntimeProofRequest> {
    if(configuration)assert(configuration.connectionId===request.selection.connection_id&&configuration.configurationGeneration===request.configurationGeneration&&configuration.sessionGeneration===request.sessionGeneration&&configuration.resourceKey===request.resourceKey,'eligibility_changed');
    const hash = this.requestHash(request);
    const identity = await this.source.transaction(async manager => {
      await lockNodiaAiQueue(manager);
      const value = await this.armed(manager, request);
      await manager.query(
        `INSERT INTO nodia_ai_api_dispatches(attempt_id,identity,request_hash,owner_machine,owner_boot,owner_pid,owner_birth,owner_instance,state)
         VALUES($1,$2::jsonb,$3,$4,$5,$6,$7,$8,'running')`,
        [request.attemptId, JSON.stringify(runtimeProofDescriptor(value)), hash,
          API_EXECUTOR_OWNER.machine, API_EXECUTOR_OWNER.boot, API_EXECUTOR_OWNER.pid,
          API_EXECUTOR_OWNER.birth, API_EXECUTOR_OWNER.instance],
      );
      if(await hasGenerationBridge(manager))await manager.query(`UPDATE ai_generation_operations SET request_hash=$2,api_owner_identity=$3::jsonb,selected_key_id=$4,updated_at=clock_timestamp() WHERE id=$1 AND owner_kind='chat'`,[request.attemptId,hash,JSON.stringify(API_EXECUTOR_OWNER),configuration?.keyId??null]);
      return value;
    });
    this.active.set(request.attemptId, hash);
    return identity;
  }

  /** Charge each actual HTTP exchange, including tool continuations, before transmission. */
  async reserveExchange(request: NodiaAiAdapterRequest): Promise<void> {
    const hash = this.requestHash(request);
    assert(this.active.get(request.attemptId) === hash && !this.locallyClosed.has(request.attemptId), 'api_executor_not_owned');
    await this.source.transaction(async manager => {
      await lockNodiaAiQueue(manager);
      await this.armed(manager, request);
      const rows: DispatchRow[] = await manager.query('SELECT * FROM nodia_ai_api_dispatches WHERE attempt_id=$1 FOR UPDATE', [request.attemptId]);
      const row = rows[0];
      assert(row?.state === 'running' && row.owner_instance === API_EXECUTOR_OWNER.instance && row.request_hash === hash, 'api_executor_not_owned');
      if (row.exchange_count > 0) {
        const changed: { id: string }[] = await manager.query(
          `WITH changed AS (UPDATE nodia_ai_runs r SET provider_dispatches_used=provider_dispatches_used+1
           FROM nodia_ai_jobs j JOIN nodia_ai_job_attempts a ON a.job_id=j.id
           WHERE a.id=$1 AND r.id=j.run_id AND r.provider_dispatches_used<(r.budget_snapshot->>'provider_dispatches')::integer RETURNING r.id)
           SELECT id FROM changed`,
          [request.attemptId],
        );
        assert(changed.length === 1, 'execution_limit');
      }
      await manager.query('UPDATE nodia_ai_api_dispatches SET exchange_count=exchange_count+1 WHERE attempt_id=$1', [request.attemptId]);
      if(await hasGenerationBridge(manager))await manager.query(`UPDATE ai_generation_operations SET phase='transport_open',reserved_exchanges=$2,started_exchanges=$2,updated_at=clock_timestamp() WHERE id=$1 AND owner_kind='chat'`,[request.attemptId,row.exchange_count+1]);
    });
  }

  private proof(identity: NodiaAiApiRuntimeProofRequest, outcome: 'completed' | 'unknown'): NodiaAiApiRuntimeTerminalProof {
    return {
      ...identity, terminalProofId: randomUUID(), localTransportClosed: true,
      remoteOutcome: outcome, outcome: outcome === 'completed' ? 'completed' : 'abandoned_unknown', observedAt: new Date(),
    };
  }

  /** Caller must have closed every local fetch and awaited all callbacks before invoking finish. */
  async finish(request: NodiaAiAdapterRequest, outcome: 'completed' | 'unknown', responseHash?: string): Promise<NodiaAiApiRuntimeTerminalProof> {
    assert(responseHash === undefined || (outcome === 'completed' && /^[a-f0-9]{64}$/.test(responseHash)), 'invalid_terminal_proof');
    const hash = this.requestHash(request);
    assert(this.active.get(request.attemptId) === hash, 'api_executor_not_owned');
    // The transport has already awaited all local work. Retain this fact if the DB write is lost.
    this.locallyClosed.set(request.attemptId, { hash, outcome, responseHash });
    const proof = await this.source.transaction(async manager => {
      await lockNodiaAiQueue(manager);
      const rows: DispatchRow[] = await manager.query('SELECT * FROM nodia_ai_api_dispatches WHERE attempt_id=$1 FOR UPDATE', [request.attemptId]);
      const row = rows[0];
      assert(row?.state === 'running' && row.owner_instance === API_EXECUTOR_OWNER.instance && row.request_hash === hash, 'api_executor_not_owned');
      const identity = readRuntimeProofRequest(row.identity);
      assert(identity.engine === 'api_key', 'invalid_terminal_proof');
      assert(outcome !== 'completed' || row.exchange_count > 0, 'invalid_terminal_proof');
      const value = this.proof(identity, outcome);
      await manager.query("UPDATE nodia_ai_api_dispatches SET state='closed',terminal_proof=$2::jsonb,response_hash=$3,closed_at=clock_timestamp() WHERE attempt_id=$1",
        [request.attemptId, JSON.stringify(terminalRuntimeProofDescriptor(value)), responseHash ?? null]);
      await finishChatGeneration(manager,request.attemptId,value);
      if(await hasGenerationBridge(manager))await manager.query('UPDATE ai_generation_operations SET response_hash=$2 WHERE id=$1',[request.attemptId,responseHash??null]);
      return value;
    });
    this.active.delete(request.attemptId);
    this.locallyClosed.delete(request.attemptId);
    return proof;
  }

  /** A qualification cannot swap either the original or the returned content after dispatch. */
  async assertCompletedRequest(request: NodiaAiAdapterRequest, proof: NodiaAiRuntimeTerminalProof,
    reply: { text: string; generatedImage?: NodiaAiGeneratedImage }): Promise<{ requestHash: string; responseHash: string }> {
    assert(proof.engine === 'api_key' && proof.outcome === 'completed', 'invalid_terminal_proof');
    assertRuntimeTerminalProof(proof, proof);
    const rows: DispatchRow[] = await this.source.manager.query('SELECT * FROM nodia_ai_api_dispatches WHERE attempt_id=$1', [request.attemptId]);
    const row = rows[0];
    assert(row?.state === 'closed' && row.request_hash === this.requestHash(request)
      && row.response_hash === apiReplyDigest(reply), 'api_qualification_payload_mismatch');
    const stored = readTerminalProof(row.terminal_proof);
    assertRuntimeTerminalProof(proof, stored);
    assert(stored.terminalProofId === proof.terminalProofId && stored.outcome === proof.outcome
      && stored.observedAt.getTime() === proof.observedAt.getTime(), 'invalid_terminal_proof');
    return { requestHash: row.request_hash, responseHash: row.response_hash! };
  }

  async reconcile(request: NodiaAiRuntimeProofRequest, signal: AbortSignal): Promise<NodiaAiApiRuntimeTerminalProof> {
    signal.throwIfAborted();
    assert(request.engine === 'api_key', 'reconciliation_identity_missing');
    const result = await this.source.transaction(async manager => {
      await lockNodiaAiQueue(manager);
      // Serialize with start's job/attempt locks. Unknown phase fences any late HTTP dispatch.
      const jobs: { state: string; descriptor: unknown }[] = await manager.query(
        `SELECT j.state,j.recovery_descriptor AS descriptor FROM nodia_ai_jobs j
         JOIN nodia_ai_job_attempts a ON a.job_id=j.id WHERE a.id=$1 FOR UPDATE OF j,a`, [request.attemptId],
      );
      assert(jobs.length === 1, 'reconciliation_changed');
      const expected = readRuntimeProofRequest(jobs[0].descriptor);
      assert(JSON.stringify(runtimeProofDescriptor(expected)) === JSON.stringify(runtimeProofDescriptor(request)), 'reconciliation_changed');
      const rows: DispatchRow[] = await manager.query('SELECT * FROM nodia_ai_api_dispatches WHERE attempt_id=$1 FOR UPDATE', [request.attemptId]);
      const row = rows[0];
      if (row?.state === 'closed') {
        const proof = readTerminalProof(row.terminal_proof);
        assert(proof.engine === 'api_key', 'invalid_terminal_proof');
        assertRuntimeTerminalProof(request, proof);
        await finishChatGeneration(manager,request.attemptId,proof);
        return proof;
      }
      assert(jobs[0].state === 'unknown', 'reconciliation_not_pending');
      const local = this.locallyClosed.get(request.attemptId);
      const attestedLocalClosure = row && row.owner_instance === API_EXECUTOR_OWNER.instance &&
        row.owner_pid === API_EXECUTOR_OWNER.pid && row.owner_birth === API_EXECUTOR_OWNER.birth &&
        row.owner_machine === API_EXECUTOR_OWNER.machine && row.owner_boot === API_EXECUTOR_OWNER.boot &&
        local?.hash === row.request_hash;
      if (row && !attestedLocalClosure) {
        assert(!this.active.has(request.attemptId) && isApiExecutorProvenClosed({
          machine: row.owner_machine, boot: row.owner_boot, pid: row.owner_pid,
          birth: row.owner_birth, instance: row.owner_instance,
        }), 'api_executor_still_active');
      }
      signal.throwIfAborted();
      const value = this.proof(request, attestedLocalClosure ? local!.outcome : 'unknown');
      if (row) {
        await manager.query("UPDATE nodia_ai_api_dispatches SET state='closed',terminal_proof=$2::jsonb,response_hash=$3,closed_at=clock_timestamp() WHERE attempt_id=$1",
          [request.attemptId, JSON.stringify(terminalRuntimeProofDescriptor(value)), attestedLocalClosure ? local!.responseHash ?? null : null]);
      } else {
        // Dispatch was armed, but no executor could start before its fence was revoked.
        await manager.query(`INSERT INTO nodia_ai_api_dispatches(attempt_id,identity,request_hash,owner_machine,owner_boot,owner_pid,owner_birth,owner_instance,state,terminal_proof,closed_at)
          VALUES($1,$2::jsonb,$3,$4,$5,$6,$7,$8,'closed',$9::jsonb,clock_timestamp())`,
        [request.attemptId, JSON.stringify(runtimeProofDescriptor(request)), digest('not_started:' + request.attemptId),
          API_EXECUTOR_OWNER.machine, API_EXECUTOR_OWNER.boot, API_EXECUTOR_OWNER.pid,
          API_EXECUTOR_OWNER.birth, API_EXECUTOR_OWNER.instance, JSON.stringify(terminalRuntimeProofDescriptor(value))]);
      }
      await finishChatGeneration(manager,request.attemptId,value);
      return value;
    });
    this.active.delete(request.attemptId);
    this.locallyClosed.delete(request.attemptId);
    return result;
  }

  async acknowledge(proof: NodiaAiRuntimeTerminalProof, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    assert(proof.engine === 'api_key', 'invalid_terminal_proof');
    assertRuntimeTerminalProof(proof, proof);
    await this.source.transaction(async manager => {
      await lockNodiaAiQueue(manager);
      const rows: DispatchRow[] = await manager.query('SELECT * FROM nodia_ai_api_dispatches WHERE attempt_id=$1 FOR UPDATE', [proof.attemptId]);
      assert(rows[0]?.state === 'closed', 'invalid_terminal_proof');
      const stored = readTerminalProof(rows[0].terminal_proof);
      assertRuntimeTerminalProof(proof, stored);
      assert(stored.terminalProofId === proof.terminalProofId && stored.outcome === proof.outcome
        && stored.observedAt.getTime() === proof.observedAt.getTime(), 'invalid_terminal_proof');
      await manager.query('UPDATE nodia_ai_api_dispatches SET acknowledged_at=COALESCE(acknowledged_at,clock_timestamp()) WHERE attempt_id=$1', [proof.attemptId]);
      if(await hasGenerationBridge(manager))await manager.query('UPDATE ai_generation_operations SET acknowledged_at=COALESCE(acknowledged_at,clock_timestamp()) WHERE id=$1',[proof.attemptId]);
    });
  }
}
