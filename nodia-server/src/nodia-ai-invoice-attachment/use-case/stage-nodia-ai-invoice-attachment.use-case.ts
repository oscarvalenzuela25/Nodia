import {
  ConflictException,
  GoneException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import { NodiaAiAttachmentStorage } from '../../nodia-ai-attachment/types/attachment-ports.js';
import { NodiaAiExecutionService } from '../../nodia-ai-execution/nodia-ai-execution.service.js';
import type { NodiaAiExecutionClaim } from '../../nodia-ai-execution/types/execution-claim.types.js';
import { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { nextNodiaAiExecutionStep } from '../../nodia-ai-execution/types/sequential-execution.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  MAX_INVOICE_FILE_BYTES,
  validateInvoiceFile,
} from '../../invoice/invoice-file-validation.js';
import {
  invoiceAttachmentStage,
  invoiceLegacyFileMediaType,
  type InvoiceFileCopyStage,
} from '../types/invoice-attachment-stage.js';

const extensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
/** A confirmed file copy is staged outside SQL; invoice_uploads owns its compensation independently of the chat. */
@Injectable()
export class StageNodiaAiInvoiceAttachmentUseCase {
  constructor(
    private readonly store: NodiaAiExecutionService,
    private readonly status: GetNodiaAiExecutionUseCase,
    private readonly proposals: ValidateNodiaAiProposalUseCase,
    private readonly storage: NodiaAiAttachmentStorage,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(
    claim: NodiaAiExecutionClaim,
    signal: AbortSignal,
  ): Promise<void> {
    if (
      claim.toolName &&
      !/^nodia_invoices_prepare_(create|update)$/u.test(claim.toolName)
    )
      return;
    const prepared = await this.prepare(claim);
    if (!prepared || prepared.ready) return;
    let folder: string | undefined;
    try {
      const remaining = prepared.deadline - Date.now();
      if (remaining <= 0) throw new GoneException('nodia_ai:execution_expired');
      const bounded = AbortSignal.any([signal, AbortSignal.timeout(remaining)]);
      bounded.throwIfAborted();
      const buffer = await this.storage.get(
        prepared.sourceKey,
        prepared.bytes,
        bounded,
      );
      bounded.throwIfAborted();
      if (
        prepared.stage.schema_version === 1 &&
        (buffer.byteLength !== prepared.bytes ||
          createHash('sha256').update(buffer).digest('hex') !==
            prepared.stage.content_hash)
      )
        throw new ConflictException('nodia_ai:attachment_content_invalid');
      validateInvoiceFile({
        buffer,
        mimetype: prepared.mediaType,
      } as Express.Multer.File);
      folder = await mkdtemp(join(tmpdir(), 'nodia-ai-invoice-'));
      const path = join(folder, 'copy');
      await writeFile(path, buffer, {
        flag: 'wx',
        mode: 0o600,
        signal: bounded,
      });
      await this.storage.put(
        prepared.stage.storage_key,
        path,
        prepared.mediaType,
        bounded,
      );
      bounded.throwIfAborted();
      await this.prepare(
        claim,
        prepared.stage.schema_version === 1
          ? prepared.stage
          : {
              ...prepared.stage,
              content_hash: createHash('sha256').update(buffer).digest('hex'),
              byte_count: String(buffer.byteLength),
            },
      );
    } finally {
      if (folder)
        await rm(folder, { recursive: true, force: true }).catch(
          () => undefined,
        );
    }
  }
  private prepare(claim: NodiaAiExecutionClaim, finish?: InvoiceFileCopyStage) {
    return this.store.transaction(async (manager) => {
      await lockAuthority(manager);
      await lockNodiaAiQueue(manager);
      const loaded = await this.status.authorize(
        manager,
        claim.identity,
        claim.executionId,
        'write',
      );
      const jobs = await this.store.jobs(manager, claim.executionId),
        execution = await this.store.execution(
          manager,
          claim.executionId,
          true,
        ),
        steps = await this.store.steps(manager, claim.executionId);
      const next = nextNodiaAiExecutionStep(steps),
        step = steps[next],
        source = loaded.steps[next],
        job = jobs[0];
      if (
        !source ||
        !/^nodia_invoices_prepare_(create|update)$/u.test(source.tool_name)
      )
        return null;
      const command = source.command_template.command;
      if (!command || typeof command !== 'object' || Array.isArray(command))
        return null;
      const target = source.preconditions.target;
      const legacy =
        !command.attachment_id &&
        source.tool_name === 'nodia_invoices_prepare_update' &&
        target &&
        typeof target === 'object' &&
        !Array.isArray(target) &&
        typeof target.path_storage === 'string' &&
        target.path_storage !== '' &&
        target.business_id !== source.preconditions.destination_business_id
          ? target
          : null;
      if (typeof command.attachment_id !== 'string' && !legacy) return null;
      const grants = await this.store.grants(manager, claim.executionId),
        grant = grants[0],
        now = await this.store.now(manager);
      const operations = [
        ...new Set(loaded.steps.map((s) => s.tool_name)),
      ].sort();
      const modules = [
        ...new Set(
          loaded.steps.flatMap(
            (s) =>
              this.proposals.preparer(s.tool_name, s.contract_hash)
                .moduleRoutes,
          ),
        ),
      ].sort();
      const resume = job?.recovery_descriptor;
      const resumed =
        !!resume &&
        resume.schema_version === 1 &&
        resume.kind === 'human_execution_resume' &&
        resume.actor_id === loaded.actor.actorId &&
        resume.session_public_id === loaded.actor.sessionId &&
        resume.proposal_hash === execution?.proposal_hash &&
        typeof resume.execution_revision === 'number' &&
        execution!.revision >= resume.execution_revision + 1 &&
        resume.expected_execution_revision === resume.execution_revision - 1;
      if (
        !execution ||
        !step ||
        jobs.length !== 1 ||
        grants.length !== 1 ||
        execution.state !== 'running' ||
        step.state !== 'running' ||
        job.state !== 'leased' ||
        job.id !== claim.jobId ||
        job.lease_owner !== claim.workerId ||
        job.fence !== claim.fence ||
        job.stage_key !== 'execution_step' ||
        job.stage_seq !== next + 1 ||
        step.id !== source.id ||
        step.source_step_id !== source.id ||
        step.tool_name !== source.tool_name ||
        step.minimal_receipt !== null ||
        step.dispatched_at !== null ||
        step.completed_at !== null ||
        execution.actor_id !== loaded.actor.actorId ||
        (resume !== null && !resumed) ||
        step.lease_fence !== claim.fence ||
        !job.lease_until ||
        job.lease_until <= now ||
        job.deadline_at <= now ||
        grant.revoked_at ||
        grant.expires_at <= now ||
        execution.retention_epoch !== loaded.chat.retention_epoch ||
        loaded.chat.active_job_id !== job.id ||
        grant.actor_id !== loaded.actor.actorId ||
        grant.session_public_id !== loaded.actor.sessionId ||
        grant.command_set_hash !== execution.proposal_hash ||
        loaded.revision.state !== 'confirmed' ||
        !this.proposals.equal(grant.allowed_operations, operations) ||
        !this.proposals.equal(grant.allowed_modules, modules) ||
        !this.proposals.equal(grant.allowed_scope, execution.minimal_scope) ||
        grant.policy_version !== this.policy.policyVersion ||
        !(await this.store.confirmedBySession(
          manager,
          execution,
          resumed ? null : loaded.actor.sessionId,
        ))
      )
        throw new ConflictException('nodia_ai:execution_conflict');
      const attempts: unknown[] = await manager.query(
        "SELECT id FROM nodia_ai_job_attempts WHERE id=$1 AND job_id=$2 AND worker_id=$3 AND fence=$4 AND phase='claimed' AND ended_at IS NULL FOR UPDATE",
        [claim.attemptId, claim.jobId, claim.workerId, claim.fence],
      );
      if (attempts.length !== 1)
        throw new ConflictException('nodia_ai:lease_lost');
      await this.status.project(manager, execution, now, loaded.steps);
      await this.proposals
        .preparer(source.tool_name, source.contract_hash)
        .verifyPreconditions(storedStep(source), loaded.context);
      const attachment = source.preconditions.attachment;
      if (
        !legacy &&
        (!attachment ||
          typeof attachment !== 'object' ||
          Array.isArray(attachment) ||
          typeof attachment.content_hash !== 'string' ||
          typeof attachment.byte_count !== 'string' ||
          typeof attachment.media_type !== 'string' ||
          !extensions[attachment.media_type])
      )
        throw new ConflictException('nodia_ai:invoice_attachment_unavailable');
      const prior = invoiceAttachmentStage(step.recovery_descriptor);
      if (finish) {
        if (
          !prior ||
          prior.status !== 'preparing' ||
          !this.proposals.equal(
            prior,
            finish.schema_version === 1
              ? finish
              : { ...finish, content_hash: null, byte_count: null },
          ) ||
          (finish.schema_version === 2 &&
            (!finish.content_hash ||
              !finish.byte_count ||
              !invoiceAttachmentStage({ ...finish, status: 'ready' })))
        )
          throw new ConflictException('nodia_ai:invoice_attachment_not_staged');
        await manager.query(
          'UPDATE nodia_ai_execution_steps SET recovery_descriptor=$2 WHERE id=$1',
          [step.id, { ...finish, status: 'ready' }],
        );
        return null;
      }
      if (step.recovery_descriptor !== null) {
        if (prior?.status === 'ready' && prior.fence === claim.fence)
          return { ready: true as const };
        // A prepared or uncertain PUT is never automatically sent again.
        throw new ConflictException('nodia_ai:invoice_attachment_not_staged');
      }
      const mediaType = legacy
        ? invoiceLegacyFileMediaType(legacy.path_storage, legacy.business_id)
        : (attachment as { media_type: string }).media_type;
      const stage: InvoiceFileCopyStage = legacy
        ? {
            schema_version: 2,
            kind: 'invoice_attachment_stage',
            status: 'preparing',
            source_step_id: source.id,
            attachment_id: null,
            source_storage_key: String(legacy.path_storage),
            content_hash: null,
            byte_count: null,
            business_id: String(source.preconditions.destination_business_id),
            storage_key: `invoices/${source.preconditions.destination_business_id}/nodia-ai-${source.id}-${claim.fence}-legacy.${extensions[mediaType]}`,
            fence: claim.fence,
          }
        : {
            schema_version: 1,
            kind: 'invoice_attachment_stage',
            status: 'preparing',
            source_step_id: source.id,
            attachment_id: command.attachment_id as string,
            content_hash: (attachment as { content_hash: string }).content_hash,
            business_id: String(source.preconditions.destination_business_id),
            storage_key: `invoices/${source.preconditions.destination_business_id}/nodia-ai-${source.id}-${claim.fence}-${(attachment as { content_hash: string }).content_hash}.${extensions[mediaType]}`,
            fence: claim.fence,
          };
      // The legacy upload recovery owns this distinct domain key even if execution/chat metadata disappears.
      await manager.query(
        "INSERT INTO invoice_uploads(storage_key,cleanup_after,retry_after) VALUES($1,clock_timestamp()+interval '10 minutes',clock_timestamp()+interval '10 minutes')",
        [stage.storage_key],
      );
      await manager.query(
        'UPDATE nodia_ai_execution_steps SET recovery_descriptor=$2 WHERE id=$1',
        [step.id, stage],
      );
      const [blob]: { storage_key: string }[] = legacy
        ? [{ storage_key: String(legacy.path_storage) }]
        : await manager.query(
            "SELECT storage_key FROM nodia_ai_attachments WHERE id=$1 AND conversation_id=$2 AND state='ready' FOR SHARE",
            [command.attachment_id, loaded.chat.id],
          );
      if (!blob)
        throw new ConflictException('nodia_ai:invoice_attachment_unavailable');
      const sessionExpiry = await this.store.sessionExpiry(
        manager,
        loaded.actor.actorId,
        loaded.actor.sessionId,
      );
      if (!sessionExpiry || sessionExpiry <= now)
        throw new GoneException('nodia_ai:execution_expired');
      return {
        ready: false as const,
        stage,
        sourceKey: blob.storage_key,
        bytes: legacy
          ? MAX_INVOICE_FILE_BYTES
          : Number((attachment as { byte_count: string }).byte_count),
        mediaType,
        // Clock domains differ in a lab: return a duration anchored to the caller clock.
        deadline:
          Date.now() +
          Math.min(
            this.policy.timing.domain_step_seconds * 1000,
            job.lease_until.getTime() - now.getTime(),
            job.deadline_at.getTime() - now.getTime(),
            sessionExpiry.getTime() - now.getTime(),
            grant.expires_at.getTime() - now.getTime(),
          ),
      };
    });
  }
}
