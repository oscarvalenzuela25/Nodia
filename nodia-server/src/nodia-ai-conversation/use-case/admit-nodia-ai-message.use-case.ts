import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { NodiaAiConversationService } from '../nodia-ai-conversation.service.js';
import { AuthorizeNodiaAiConversationUseCase } from './authorize-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiConversationUseCase } from './project-nodia-ai-conversation.use-case.js';
import { ProjectNodiaAiRunUseCase } from './project-nodia-ai-run.use-case.js';
import { conversationId } from './get-nodia-ai-conversation.use-case.js';
import { validateNodiaAiDto } from '../dto/nodia-ai-validation.js';
import { CreateNodiaAiMessageDto } from '../dto/create-nodia-ai-message.dto.js';
import {
  NODIA_AI_ADMISSION_PREPARER,
  type NodiaAiAdmissionPreparer,
} from '../types/nodia-ai-admission.types.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import { NodiaAiMessage } from '../entities/nodia-ai-message.entity.js';
import { NodiaAiMessagePart } from '../entities/nodia-ai-message-part.entity.js';
import { NodiaAiRun } from '../../nodia-ai-run/entities/nodia-ai-run.entity.js';
import { NodiaAiJob } from '../../nodia-ai-runtime/entities/nodia-ai-job.entity.js';
import { NodiaAiExecutionGrant } from '../../nodia-ai-runtime/entities/nodia-ai-execution-grant.entity.js';
import type { EntityManager } from 'typeorm';
import type { NodiaAiConversation } from '../entities/nodia-ai-conversation.entity.js';
import { appendNodiaAiEvent } from '../../nodia-ai-run/event-journal.js';
import { ManageNodiaAiAttachmentUseCase } from '../../nodia-ai-attachment/use-case/manage-nodia-ai-attachment.use-case.js';
import { isNodiaAiNativeFormatVerified } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';

@Injectable()
export class AdmitNodiaAiMessageUseCase {
  constructor(
    private readonly conversations: NodiaAiConversationService,
    private readonly access: AuthorizeNodiaAiConversationUseCase,
    private readonly project: ProjectNodiaAiConversationUseCase,
    private readonly runs: ProjectNodiaAiRunUseCase,
    @Inject(NODIA_AI_ADMISSION_PREPARER)
    private readonly preparer: NodiaAiAdmissionPreparer,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly attachments?: ManageNodiaAiAttachmentUseCase,
  ) {}
  async execute(identity: NodiaAiActorReference, id: string, input: unknown) {
    const key = conversationId(id);
    const dto = validateNodiaAiDto(CreateNodiaAiMessageDto, input);
    if (
      dto.parts.length > this.policy.admission.parts_per_message ||
      dto.parts.reduce(
        (total, part) =>
          total +
          (part.kind === 'text' ? Buffer.byteLength(part.text, 'utf8') : 0),
        0,
      ) > this.policy.admission.message_text_utf8_bytes
    )
      throw new BadRequestException('nodia_ai:invalid_input');
    const clientId = dto.client_message_id.toLowerCase();
    const attachmentRefs = dto.parts.filter((part) => part.kind !== 'text');
    if (attachmentRefs.length && !this.attachments)
      throw new BadRequestException('nodia_ai:modality_unavailable');
    // Revision is an admission precondition; it is deliberately excluded from the identity of an already admitted message.
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          conversation_id: key,
          actor_id: identity.userId,
          parts: dto.parts.map((part) =>
            part.kind === 'text'
              ? { kind: 'text', text: part.text }
              : { kind: part.kind, attachment_id: part.attachment_id },
          ),
        }),
      )
      .digest('hex');
    const preflight = await this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      const { chat } = await this.access.execute(
        manager,
        identity,
        key,
        'write',
      );
      const duplicate = await this.recover(
        manager,
        chat,
        identity.userId,
        clientId,
        hash,
      );
      if (duplicate) return { duplicate } as const;
      this.acceptRevision(chat, dto.expected_conversation_revision);
      const attachments = attachmentRefs.length
        ? await this.attachments!.bindForMessage(
            manager,
            identity,
            chat,
            attachmentRefs,
            true,
          )
        : [];
      return { chat: this.project.execute(chat), attachments } as const;
    });
    if ('duplicate' in preflight) return preflight.duplicate;
    const observation = await this.preparer.observe(identity, preflight.chat);
    return this.conversations.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const { actor, chat, now } = await this.access.execute(
        manager,
        identity,
        key,
        'write',
      );
      const duplicate = await this.recover(
        manager,
        chat,
        actor.actorId,
        clientId,
        hash,
      );
      if (duplicate) return duplicate;
      this.acceptRevision(chat, dto.expected_conversation_revision);
      const attachments = attachmentRefs.length
        ? await this.attachments!.bindForMessage(
            manager,
            identity,
            chat,
            attachmentRefs,
            true,
          )
        : [];
      if (JSON.stringify(attachments) !== JSON.stringify(preflight.attachments))
        throw new ConflictException('nodia_ai:revision_conflict');
      const admittedParts = dto.parts.map((part) =>
        part.kind === 'text'
          ? { kind: part.kind, text: part.text, attachment_id: null }
          : {
              kind: part.kind,
              attachment_id: part.attachment_id,
              text: attachments.find(
                (item) => item.attachment_id === part.attachment_id,
              )!.text,
            },
      );
      const admittedBytes = admittedParts.reduce(
        (total, part) => total + Buffer.byteLength(part.text ?? '', 'utf8'),
        0,
      );
      if (admittedBytes > this.policy.admission.message_text_utf8_bytes)
        throw new BadRequestException('nodia_ai:invalid_input');
      const [counts]: { global_waiting: string; owner_waiting: string }[] =
        await manager.query(
          `SELECT count(*) FILTER (WHERE j.state IN ('ready','waiting'))::text AS global_waiting,
        count(*) FILTER (WHERE j.state IN ('ready','waiting') AND c.owner_id=$1)::text AS owner_waiting
        FROM nodia_ai_jobs j JOIN nodia_ai_conversations c ON c.id=j.conversation_id WHERE j.kind='turn' AND c.lifecycle='active' AND c.expires_at>$2`,
          [actor.actorId, now],
        );
      if (
        Number(counts.global_waiting) >= this.policy.queue.waiting_global ||
        Number(counts.owner_waiting) >= this.policy.queue.waiting_per_owner
      )
        throw new HttpException(
          {
            message: 'nodia_ai:execution_limit',
            retry_after_seconds: this.policy.queue.local_retry_after_seconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const storage: { chat_bytes: string; owner_bytes: string } = this
        .attachments
        ? await this.attachments.usageForAdmission(
            manager,
            chat.id,
            actor.actorId,
            now,
          )
        : (
            await manager.query(
              `SELECT COALESCE(sum(octet_length(p.text)) FILTER (WHERE c.id=$1),0)::text AS chat_bytes,
          COALESCE(sum(octet_length(p.text)),0)::text AS owner_bytes
          FROM nodia_ai_conversations c JOIN nodia_ai_message_parts p ON p.conversation_id=c.id WHERE c.owner_id=$2`,
              [chat.id, actor.actorId],
            )
          )[0];
      const inputBytes =
        admittedBytes + this.policy.results.assistant_text_utf8_bytes;
      if (
        BigInt(storage.chat_bytes) + BigInt(inputBytes) >
          BigInt(this.policy.admission.chat_storage_bytes) ||
        BigInt(storage.owner_bytes) + BigInt(inputBytes) >
          BigInt(this.policy.admission.owner_storage_bytes)
      )
        throw new HttpException(
          {
            message: 'nodia_ai:execution_limit',
            retry_after_seconds: this.policy.queue.local_retry_after_seconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      const prepared = await this.preparer.prepare(
        manager,
        actor,
        chat,
        now,
        observation,
      );
      const formats = prepared.contextManifest.verified_attachment_media_types;
      const verifiedFormats = Array.isArray(formats)
        ? formats.filter((value): value is string => typeof value === 'string') : [];
      if (
        attachments.some(
          (file) =>
            file.text === null &&
            !isNodiaAiNativeFormatVerified(verifiedFormats, file.kind, file.metadata.media_type),
        )
      )
        throw new ConflictException('nodia_ai:attachment_review_required');
      const projected = this.project.execute(chat);
      if (
        !projected.selection ||
        projected.selection.connection_id !==
          prepared.selection.connection_id ||
        projected.selection.mode !== prepared.selection.mode ||
        projected.selection.model_id !== prepared.selection.model_id ||
        projected.selection.effort_id !== prepared.selection.effort_id
      )
        throw new ConflictException('nodia_ai:revision_conflict');
      const messageId = randomUUID(),
        runId = randomUUID(),
        jobId = randomUUID();
      const nextSeq = BigInt(chat.next_message_seq) + 1n;
      if (nextSeq > 9223372036854775807n)
        throw new ConflictException('nodia_ai:execution_limit');
      const deadline = new Date(
        now.getTime() + this.policy.timing.run_seconds * 1000,
      );
      const budget = {
        schema_version: 1 as const,
        tool_calls: this.policy.budget.tool_calls_per_run,
        mcp_rpc_messages: this.policy.budget.mcp_rpc_messages_per_run,
        provider_dispatches: this.policy.budget.provider_dispatches_per_run,
        compactions: this.policy.budget.compactions_per_run,
        delegations: this.policy.budget.delegations_per_run,
      };
      const run = Object.assign(new NodiaAiRun(), {
        id: runId,
        conversation_id: key,
        actor_id: actor.actorId,
        user_message_id: messageId,
        assistant_message_id: null,
        connection_id: prepared.selection.connection_id,
        selection_snapshot: prepared.selection,
        catalog_version: prepared.catalogVersion,
        policy_version: this.policy.policyVersion,
        policy_hash: this.policy.policyHash,
        input_through_seq: nextSeq.toString(),
        revision: 1,
        state: 'queued',
        phase: 'queued',
        deadline_at: deadline,
        error_code: null,
        created_at: now,
        completed_at: null,
        retention_epoch: chat.retention_epoch,
        context_manifest: {
          ...prepared.contextManifest,
          admission_conversation_revision: chat.revision + 1,
        },
        routing_snapshot: projected.routing,
        budget_snapshot: budget,
        tool_calls_used: 0,
        mcp_rpc_messages_used: 0,
        provider_dispatches_used: 0,
        compactions_used: 0,
        delegations_used: 0,
      });
      // Projection validates the frozen snapshots before any row is written.
      const summary = this.runs.execute(run);
      await manager.getRepository(NodiaAiMessage).save(
        Object.assign(new NodiaAiMessage(), {
          id: messageId,
          conversation_id: key,
          seq: nextSeq.toString(),
          role: 'user',
          author_id: actor.actorId,
          client_message_id: clientId,
          status: 'sealed',
          source_scope_manifest: { schema_version: 1, module_routes: [] },
          created_at: now,
          sealed_at: now,
          input_hash: hash,
        }),
      );
      await manager.getRepository(NodiaAiMessagePart).insert(
        admittedParts.map((part, index) => ({
          message_id: messageId,
          conversation_id: key,
          part_index: index,
          kind: part.kind,
          text: part.text,
          attachment_id: part.attachment_id,
        })),
      );
      await manager.getRepository(NodiaAiRun).save(run);
      await manager.getRepository(NodiaAiExecutionGrant).save(
        Object.assign(new NodiaAiExecutionGrant(), {
          id: randomUUID(),
          actor_id: actor.actorId,
          session_public_id: actor.sessionId,
          run_id: runId,
          allowed_modules: prepared.allowedModules,
          allowed_operations: prepared.allowedOperations,
          allowed_scope: prepared.grantScope,
          policy_version: this.policy.policyVersion,
          expires_at: deadline,
          revoked_at: null,
          created_at: now,
        }),
      );
      await manager.getRepository(NodiaAiJob).save(
        Object.assign(new NodiaAiJob(), {
          id: jobId,
          kind: 'turn',
          dedup_key: `turn:${runId}`,
          conversation_id: key,
          run_id: runId,
          storage_key: null,
          storage_generation: null,
          recovery_descriptor: null,
          state: 'ready',
          available_at: now,
          lease_owner: null,
          lease_until: null,
          fence: '0',
          attempt_count: 0,
          deadline_at: deadline,
          created_at: now,
          updated_at: now,
          stage_key: 'context',
          stage_seq: 1,
        }),
      );
      chat.active_job_id = jobId;
      chat.next_message_seq = nextSeq.toString();
      chat.revision++;
      chat.last_owner_message_at = now;
      chat.expires_at = new Date(
        now.getTime() + this.policy.retention.chat_days * 86400000,
      );
      chat.updated_at = now;
      await this.conversations.save(manager, chat);
      await appendNodiaAiEvent(manager, {
        conversationId: key,
        runId,
        eventKey: `run:${runId}:accepted`,
        kind: 'run_accepted',
        payload: { message_id: messageId, run_revision: run.revision },
        moduleRoutes: [],
        maxEvents: this.policy.results.outbox_events_per_activity,
      });
      return {
        message_id: messageId,
        conversation_revision: chat.revision,
        run: summary,
      };
    });
  }
  private acceptRevision(chat: NodiaAiConversation, revision: number) {
    if (chat.revision !== revision || chat.revision >= 2147483647)
      throw new ConflictException('nodia_ai:revision_conflict');
    if (chat.active_job_id)
      throw new ConflictException('nodia_ai:conversation_busy');
  }
  private async recover(
    manager: EntityManager,
    chat: NodiaAiConversation,
    actorId: string,
    clientId: string,
    hash: string,
  ) {
    const message = await this.conversations.findMessageRequest(
      manager,
      chat.id,
      actorId,
      clientId,
    );
    if (!message) return null;
    if (message.input_hash !== hash)
      throw new ConflictException('nodia_ai:request_conflict');
    const run = await this.conversations.findMessageRun(manager, message.id);
    if (!run)
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    const revision = run.context_manifest.admission_conversation_revision;
    if (
      typeof revision !== 'number' ||
      !Number.isInteger(revision) ||
      revision < 1
    )
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    return {
      message_id: message.id,
      conversation_revision: revision,
      run: this.runs.execute(run),
    };
  }
}
