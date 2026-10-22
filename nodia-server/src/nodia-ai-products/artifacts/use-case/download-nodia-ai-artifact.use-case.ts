import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { lockAuthority } from '../../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../../nodia-ai/types/nodia-ai-authorization.types.js';
import { AuthorizeNodiaAiUseCase } from '../../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { AuthorizeNodiaAiConversationUseCase } from '../../../nodia-ai-conversation/use-case/authorize-nodia-ai-conversation.use-case.js';
import { NodiaAiToolCall } from '../../../nodia-ai-run/entities/nodia-ai-tool-call.entity.js';
import { NODIA_AI_RUNTIME_POLICY, type NodiaAiRuntimePolicy } from '../../../nodia-ai-runtime/config/runtime-policy.js';
import { StorageService } from '../../../common/storage/storage.service.js';
import { MAX_INVOICE_FILE_BYTES } from '../../../invoice/invoice-file-validation.js';
import { canonicalKnowledge, knowledgeHash } from '../../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import { ExecuteNodiaAiArtifactUseCase, NODIA_AI_ARTIFACT_OPERATIONS, type NodiaAiArtifactOperation, type NodiaAiMaterializedArtifact } from './execute-nodia-ai-artifact.use-case.js';

interface DownloadSnapshot {
  readonly call: NodiaAiToolCall;
  readonly artifact: NodiaAiMaterializedArtifact;
}
/** Human-only endpoint. Every access rechecks chat, session, destination and current native data. */
@Injectable()
export class DownloadNodiaAiArtifactUseCase {
  constructor(
    private readonly source: DataSource,
    private readonly authorize: AuthorizeNodiaAiUseCase,
    private readonly authorizeChat: AuthorizeNodiaAiConversationUseCase,
    private readonly artifacts: ExecuteNodiaAiArtifactUseCase,
    private readonly storage: StorageService,
    @Inject(NODIA_AI_RUNTIME_POLICY) private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, reference: string, signal?: AbortSignal): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference))
      throw new NotFoundException('nodia_ai:artifact_not_found');
    const timed = AbortSignal.timeout(this.policy.timing.domain_step_seconds * 1000);
    const combined = signal ? AbortSignal.any([signal, timed]) : timed;
    combined.throwIfAborted();
    const initial = await this.read(identity, reference, combined, true);
    combined.throwIfAborted();
    let buffer: Buffer;
    if (initial.artifact.invoiceKey) {
      try {
        buffer = await this.storage.downloadFile(initial.artifact.invoiceKey, Math.min(MAX_INVOICE_FILE_BYTES, this.policy.admission.file_bytes), combined);
      } catch (error) {
        combined.throwIfAborted();
        if (error instanceof BadRequestException) throw error;
        throw new ServiceUnavailableException('nodia_ai:artifact_storage_unavailable');
      }
    } else {
      if (!initial.artifact.buffer) throw new ServiceUnavailableException('nodia_ai:artifact_unavailable');
      buffer = initial.artifact.buffer;
    }
    combined.throwIfAborted();
    // No authority lock or DB connection is held across object storage I/O.
    const current = await this.read(identity, reference, combined, false);
    combined.throwIfAborted();
    if (current.call.arguments_hash !== initial.call.arguments_hash || current.call.tool_name !== initial.call.tool_name ||
      current.call.contract_hash !== initial.call.contract_hash || current.artifact.invoiceKey !== initial.artifact.invoiceKey)
      throw new NotFoundException('nodia_ai:artifact_not_found');
    if (buffer.byteLength > this.policy.admission.file_bytes)
      throw new BadRequestException('nodia_ai:artifact_limit');
    return { buffer, filename: initial.artifact.filename, mimeType: initial.artifact.mimeType };
  }
  private async read(identity: NodiaAiActorReference, reference: string, signal: AbortSignal, materialize: boolean): Promise<DownloadSnapshot> {
    return this.source.transaction('REPEATABLE READ', async (manager: EntityManager) => {
      signal.throwIfAborted();
      await lockAuthority(manager, false, this.policy.timing.read_query_seconds * 1000);
      // Authenticate before looking up a private reference; no resource IDs come from a query string.
      await this.authorize.execute(identity, { moduleRoutes: ['/tools/business'] }, manager);
      const call = await manager.getRepository(NodiaAiToolCall).findOneBy({ id: reference });
      if (!call || call.state !== 'completed' || !call.completed_at)
        throw new NotFoundException('nodia_ai:artifact_not_found');
      const { actor } = await this.authorizeChat.execute(manager, identity, call.conversation_id, 'read', materialize ? undefined : 'artifact_download');
      const operation = call.tool_name.replace(/^nodia_/, '') as NodiaAiArtifactOperation;
      const result = call.public_result?.artifact;
      if (!NODIA_AI_ARTIFACT_OPERATIONS.includes(operation) || call.arguments_hash !== knowledgeHash(canonicalKnowledge(call.arguments)) ||
        !result || typeof result !== 'object' || Array.isArray(result) || result.reference !== call.id ||
        result.semantics !== 'current_on_download' || result.access !== 'authenticated_reauthorized')
        throw new NotFoundException('nodia_ai:artifact_not_found');
      const context = { manager, actor, moduleRoutes: actor.modules.map((module) => module.route), signal,
        conversationId: call.conversation_id, runId: call.run_id, toolCallId: call.id,
        statementTimeoutMs: this.policy.timing.read_query_seconds * 1000 };
      let artifact: NodiaAiMaterializedArtifact;
      if (materialize || operation === 'invoices_file') {
        artifact = await this.artifacts.materialize(operation, call.arguments, context, this.policy);
      } else {
        await this.artifacts.verifyAuthority(operation, call.arguments, context);
        artifact = { filename: '', mimeType: '' };
      }
      signal.throwIfAborted();
      return { call, artifact };
    });
  }
}
