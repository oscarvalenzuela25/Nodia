import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { QueryFailedError } from 'typeorm';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import {
  withCoreAuthorityLock,
  assertCoreAuthorityTransaction,
} from '../../authorization/core-authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import { conversationId } from '../../nodia-ai-conversation/types/conversation-id.js';
import { GetNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/get-nodia-ai-proposal.use-case.js';
import { CanonicalizeNodiaAiProposalUseCase } from '../../nodia-ai-proposal/use-case/canonicalize-nodia-ai-proposal.use-case.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from '../../nodia-ai-proposal/use-case/validate-nodia-ai-proposal.use-case.js';
import { GetNodiaAiExecutionUseCase } from '../../nodia-ai-confirmation/use-case/get-nodia-ai-execution.use-case.js';
import { ExecuteNodiaAiLocalEffectUseCase } from '../../nodia-ai-native-effect/use-case/execute-nodia-ai-local-effect.use-case.js';
import {
  nodiaAiLocalOperationIdentity,
  buildNodiaAiLocalReceipt,
  validateNodiaAiLocalReceipt,
  nodiaAiCoreOperationIdentity,
} from '../../nodia-ai-proposal/types/local-operation.types.js';
import { lockNodiaAiQueue } from '../../nodia-ai-runtime/queue-lock.js';
import { appendNodiaAiExecutionEvent } from '../../nodia-ai-run/event-journal.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  boundNodiaAiProposalStep,
  nodiaAiBoundExecutionBinding,
} from '../types/bound-execution-step.js';
import { nextNodiaAiExecutionStep } from '../types/sequential-execution.js';
import { NODIA_AI_WORKFLOW_CATALOG_VERSION } from '../../nodia-ai-proposal/types/workflow.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { StoredProposalStep } from '../../nodia-ai-proposal/types/proposal-preparer.types.js';
import { NodiaAiExecutionService } from '../nodia-ai-execution.service.js';
import type { NodiaAiExecutionClaim } from '../types/execution-claim.types.js';
import { invoiceAttachmentStage } from '../../nodia-ai-invoice-attachment/types/invoice-attachment-stage.js';
import {
  NODIA_AI_DELETION_JOURNAL,
  NODIA_AI_DELETION_PROOF,
  type NodiaAiDeletionJournalPort,
} from '../../nodia-ai-recovery/types/deletion-journal.js';

const FIRST_BOUND = Symbol('nodia_ai_first_bound');
const DELETION_REQUIRED = Symbol('nodia_ai_deletion_required');
const DELETION_COMMITTED = Symbol('nodia_ai_deletion_committed');
interface PreferenceDeletionProof {
  executionStepId: string;
  preferenceId: string;
}

/** One local SQL effect; a claimed delivery is fenced before any native write. */
@Injectable()
export class ExecuteNodiaAiLocalExecutionUseCase {
  constructor(
    private readonly store: NodiaAiExecutionService,
    private readonly get: GetNodiaAiProposalUseCase,
    private readonly status: GetNodiaAiExecutionUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
    private readonly canonical: CanonicalizeNodiaAiProposalUseCase,
    private readonly effect: ExecuteNodiaAiLocalEffectUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    @Inject(NODIA_AI_DELETION_JOURNAL)
    private readonly deletionJournal: NodiaAiDeletionJournalPort,
  ) {}
  async execute(
    identity: NodiaAiActorReference,
    executionId: string,
    claim?: NodiaAiExecutionClaim,
  ) {
    let deletionProof: PreferenceDeletionProof | undefined;
    for (let phase = 0; phase < 3; phase++) {
      const result = await this.executeStep(
        identity,
        executionId,
        claim,
        deletionProof,
      );
      if (
        result !== FIRST_BOUND &&
        'kind' in result &&
        result.kind === DELETION_REQUIRED
      ) {
        const resource = {
          kind: 'preference' as const,
          preference_id: result.proof.preferenceId,
        };
        // This phase runs only after the preceding transaction released every lock.
        await this.deletionJournal.recordResources({
          deleted_at: result.deletedAt,
          resources: [resource],
        });
        await this.deletionJournal.assertResourcesRecorded([resource]);
        deletionProof = result.proof;
        continue;
      }
      if (
        result !== FIRST_BOUND &&
        'kind' in result &&
        result.kind === DELETION_COMMITTED
      ) {
        try {
          await this.deletionJournal.confirmResources([
            { kind: 'preference', preference_id: result.proof.preferenceId },
          ]);
        } catch {
          // The atomic effect/receipt committed already; keep the external intent
          // pending for reconciliation, never turn it into a duplicate retry.
          new Logger(ExecuteNodiaAiLocalExecutionUseCase.name).warn(
            'nodia_ai:deletion_journal_confirmation_pending',
          );
        }
        return result.projection;
      }
      if (result !== FIRST_BOUND) return result;
      // First-bind was durably committed separately. Reacquire every execution,
      // authority and grant lock before the native effect can start.
    }
    throw new ConflictException('nodia_ai:execution_conflict');
  }
  private async executeStep(
    identity: NodiaAiActorReference,
    executionId: string,
    claim?: NodiaAiExecutionClaim,
    deletionProof?: PreferenceDeletionProof,
  ) {
    const id = conversationId(executionId);
    let workFinished = false;
    let exclusive = false;
    try {
      exclusive = await this.store.requiresExclusiveAuthority(id);
      return await this.store.transaction(async (manager) => {
        const work = async () => {
          if (!exclusive)
            await lockAuthority(
              manager,
              false,
              this.policy.timing.read_query_seconds * 1000,
            );
          await lockNodiaAiQueue(manager);
          const initial = await this.store.execution(manager, id);
          if (!initial?.proposal_id || !initial.conversation_id)
            throw new NotFoundException('nodia_ai:operation_not_found');
          // This authorizes the current actor and locks the chat before job/domain locks.
          const loaded = await this.get.load(
            manager,
            identity,
            initial.proposal_id,
            'write',
            initial.origin_proposal_revision,
          );
          const jobs = await this.store.jobs(manager, id);
          const execution = await this.store.execution(manager, id, true);
          if (
            !execution ||
            execution.proposal_id !== loaded.proposal.id ||
            execution.origin_proposal_id !== loaded.proposal.id ||
            execution.conversation_id !== loaded.chat.id ||
            execution.origin_conversation_id !== loaded.chat.id ||
            execution.origin_proposal_revision !== loaded.revision.revision ||
            execution.actor_id !== loaded.actor.actorId ||
            execution.chat_owner_id !== loaded.chat.owner_id ||
            execution.proposal_hash !== loaded.revision.hash ||
            execution.catalog_version !== loaded.revision.catalog_version ||
            loaded.revision.state !== 'confirmed'
          )
            throw new ConflictException('nodia_ai:execution_conflict');
          const steps = await this.store.steps(manager, id);
          // Full frozen identity verification is shared with the human status projection.
          await this.status.project(
            manager,
            execution,
            loaded.now,
            loaded.steps,
          );
          const next = nextNodiaAiExecutionStep(steps);
          if (
            !loaded.steps.length ||
            loaded.steps.length > this.policy.budget.steps_per_proposal ||
            steps.length !== loaded.steps.length ||
            next < 0 ||
            (loaded.steps.length === 1 &&
              (loaded.steps[0].output_bindings.length !== 0 ||
                !Array.isArray(loaded.steps[0].public_step.depends_on) ||
                loaded.steps[0].public_step.depends_on.length !== 0 ||
                !Array.isArray(loaded.steps[0].public_step.output_bindings) ||
                loaded.steps[0].public_step.output_bindings.length !== 0)) ||
            loaded.steps.some(
              (item) => !nodiaAiLocalOperationIdentity(item.tool_name),
            )
          )
            throw new ConflictException('nodia_ai:execution_unsupported');
          if (execution.state === 'completed')
            return this.status.project(
              manager,
              execution,
              await this.store.now(manager),
              loaded.steps,
            );
          const step = steps[next];
          const original = loaded.steps[next];
          if (!step || !original)
            throw new ConflictException('nodia_ai:execution_conflict');
          const source = boundNodiaAiProposalStep(original, step);
          // A stale/forged hint can never upgrade a SHARE transaction into an authority writer.
          if (nodiaAiCoreOperationIdentity(source.tool_name))
            assertCoreAuthorityTransaction(manager);
          const registration = this.validate.preparer(
            source.tool_name,
            source.contract_hash,
          );
          if (
            registration.catalogVersion !== execution.catalog_version &&
            execution.catalog_version !== NODIA_AI_WORKFLOW_CATALOG_VERSION
          )
            throw new ConflictException('nodia_ai:catalog_changed');
          const boundHash = createHash('sha256')
            .update(
              this.canonical.execute(
                nodiaAiBoundExecutionBinding(
                  source,
                  step.bound_command != null,
                ),
              ),
            )
            .digest('hex');
          const stagedFile = invoiceAttachmentStage(step.recovery_descriptor);
          const stagedInvoice =
            !!claim &&
            /^nodia_invoices_prepare_(create|update)$/u.test(
              source.tool_name,
            ) &&
            stagedFile?.status === 'ready' &&
            stagedFile.source_step_id === source.id &&
            stagedFile.fence === claim.fence;
          if (
            step.bound_command_hash !== null &&
            step.bound_command_hash !== boundHash
          )
            throw new ConflictException('nodia_ai:execution_conflict');
          if (
            execution.state !== (claim ? 'running' : 'queued') ||
            step.state !== (claim ? 'running' : 'ready') ||
            step.minimal_receipt !== null ||
            step.dispatched_at !== null ||
            step.completed_at !== null ||
            (step.recovery_descriptor !== null && !stagedInvoice) ||
            step.lease_fence !== (claim?.fence ?? '0') ||
            step.error_code !== null ||
            jobs.length !== 1
          )
            throw new ConflictException('nodia_ai:execution_conflict');
          const job = jobs[0];
          if (
            job.kind !== 'execution' ||
            job.execution_id !== id ||
            job.conversation_id !== loaded.chat.id ||
            job.run_id !== null ||
            job.state !== (claim ? 'leased' : 'ready') ||
            job.stage_key !== 'execution_step' ||
            job.stage_seq !== next + 1 ||
            job.lease_owner !== (claim?.workerId ?? null) ||
            (!claim && job.lease_until !== null) ||
            (!claim && job.attempt_count !== 0) ||
            job.fence !== (claim?.fence ?? '0') ||
            (!claim && job.recovery_descriptor !== null) ||
            loaded.chat.active_job_id !== job.id ||
            execution.retention_epoch !== loaded.chat.retention_epoch ||
            (!claim && (await this.store.hasAttempts(manager, job.id)))
          )
            throw new ConflictException('nodia_ai:execution_conflict');
          if (claim) {
            if (
              claim.executionId !== id ||
              claim.jobId !== job.id ||
              claim.identity.userId !== identity.userId ||
              claim.identity.sessionId !== identity.sessionId ||
              !job.lease_until ||
              job.lease_until <= (await this.store.now(manager))
            )
              throw new ConflictException('nodia_ai:lease_lost');
            const attempts: { id: string }[] = await manager.query(
              `SELECT id FROM nodia_ai_job_attempts WHERE id=$1 AND job_id=$2 AND worker_id=$3
              AND fence=$4 AND phase='claimed' AND ended_at IS NULL FOR UPDATE`,
              [claim.attemptId, job.id, claim.workerId, claim.fence],
            );
            if (attempts.length !== 1)
              throw new ConflictException('nodia_ai:lease_lost');
          }
          const grants = await this.store.grants(manager, id);
          const grant = grants[0];
          const modules = [
            ...new Set(
              loaded.steps.flatMap(
                (item) =>
                  this.validate.preparer(item.tool_name, item.contract_hash)
                    .moduleRoutes,
              ),
            ),
          ].sort();
          const operations = [
            ...new Set(loaded.steps.map((item) => item.tool_name)),
          ].sort();
          const resume = job.recovery_descriptor;
          const resumed =
            !!claim &&
            !!resume &&
            resume.schema_version === 1 &&
            resume.kind === 'human_execution_resume' &&
            resume.actor_id === loaded.actor.actorId &&
            resume.session_public_id === loaded.actor.sessionId &&
            resume.proposal_hash === execution.proposal_hash &&
            typeof resume.execution_revision === 'number' &&
            execution.revision >= resume.execution_revision + 1 &&
            resume.expected_execution_revision ===
              resume.execution_revision - 1;
          if (resume !== null && !resumed)
            throw new ForbiddenException('nodia_ai:execution_grant_invalid');
          if (
            grants.length !== 1 ||
            grant.actor_id !== loaded.actor.actorId ||
            grant.session_public_id !== loaded.actor.sessionId ||
            grant.run_id !== null ||
            grant.execution_id !== id ||
            grant.command_set_hash !== execution.proposal_hash ||
            grant.policy_version !== this.policy.policyVersion ||
            grant.revoked_at !== null ||
            !this.validate.equal(grant.allowed_modules, modules) ||
            !this.validate.equal(grant.allowed_operations, operations) ||
            !this.validate.equal(grant.allowed_scope, execution.minimal_scope)
          )
            throw new ForbiddenException('nodia_ai:execution_grant_invalid');
          if (
            !(await this.store.confirmedBySession(
              manager,
              execution,
              resumed ? null : loaded.actor.sessionId,
            ))
          )
            throw new ForbiddenException('nodia_ai:execution_grant_invalid');
          const sessionExpiry = await this.store.sessionExpiry(
            manager,
            loaded.actor.actorId,
            loaded.actor.sessionId,
          );
          let now = await this.store.now(manager);
          if (
            !sessionExpiry ||
            now >= sessionExpiry ||
            now >= grant.expires_at ||
            now >= job.deadline_at ||
            now >= loaded.chat.expires_at
          )
            throw new GoneException('nodia_ai:execution_expired');
          if (now < job.available_at)
            throw new ConflictException('nodia_ai:execution_conflict');
          const effectDeadline = Math.min(
            now.getTime() + this.policy.timing.domain_step_seconds * 1000,
            sessionExpiry.getTime(),
            grant.expires_at.getTime(),
            job.deadline_at.getTime(),
            loaded.chat.expires_at.getTime(),
            ...(claim && job.lease_until ? [job.lease_until.getTime()] : []),
          );
          if (loaded.steps.length > 1 && step.bound_command == null) {
            let resolved = storedStep(source);
            if (source.output_bindings.length) {
              if (!registration.bindOutputs)
                throw new ConflictException('nodia_ai:execution_unsupported');
              const values: Record<
                string,
                { value: string; source: StoredProposalStep }
              > = {};
              for (const binding of source.output_bindings) {
                const target = binding.target_field_key;
                const output = binding.output_key;
                const prior = loaded.steps.findIndex(
                  (item) => item.id === binding.from_step_id,
                );
                if (
                  typeof target !== 'string' ||
                  output !== 'id' ||
                  prior < 0 ||
                  prior >= next ||
                  Object.hasOwn(values, target) ||
                  steps[prior].state !== 'completed'
                )
                  throw new ConflictException('nodia_ai:execution_conflict');
                const ancestor = boundNodiaAiProposalStep(
                  loaded.steps[prior],
                  steps[prior],
                );
                const ancestorRegistration = this.validate.preparer(
                  ancestor.tool_name,
                  ancestor.contract_hash,
                );
                if (
                  !registration.bindableFields[target] ||
                  registration.bindableFields[target] !==
                    ancestorRegistration.outputKeys[output]
                )
                  throw new ConflictException('nodia_ai:execution_conflict');
                const reference = validateNodiaAiLocalReceipt(
                  ancestor,
                  steps[prior].minimal_receipt,
                  (schema, value, persisted) =>
                    this.validate.assert(schema, value, persisted),
                );
                values[target] = {
                  value: reference.id,
                  source: storedStep(ancestor),
                };
              }
              const prepared = await registration.bindOutputs(
                resolved,
                values,
                loaded.context,
              );
              if (
                !this.validate.equal(prepared.publicStep, resolved.publicStep)
              )
                throw new ConflictException('nodia_ai:execution_conflict');
              resolved = {
                ...resolved,
                commandTemplate: prepared.commandTemplate,
                scope: prepared.scope,
                preconditions: prepared.preconditions,
              };
            }
            const bound: NodiaAiJsonObject = {
              command_template: resolved.commandTemplate,
              scope: resolved.scope,
              preconditions: resolved.preconditions,
            };
            const materialized = {
              ...source,
              command_template: resolved.commandTemplate,
              scope: resolved.scope,
              preconditions: resolved.preconditions,
            };
            const hash = createHash('sha256')
              .update(
                this.canonical.execute(
                  nodiaAiBoundExecutionBinding(materialized, true),
                ),
              )
              .digest('hex');
            boundNodiaAiProposalStep(original, {
              ...step,
              bound_command: bound,
              bound_command_hash: hash,
            });
            await this.store.bind(manager, step, bound, hash);
            if ((await this.store.now(manager)).getTime() >= effectDeadline)
              throw new GoneException('nodia_ai:execution_expired');
            return FIRST_BOUND;
          }
          const domainStep = storedStep(source);
          const deletingPreference =
            this.deletionJournal.enabled &&
            source.tool_name === 'nodia_preferences_prepare_delete';
          if (
            deletingPreference &&
            (deletionProof?.executionStepId !== step.id ||
              deletionProof.preferenceId !== domainStep.commandTemplate.id)
          ) {
            // Verify the exact confirmed target before creating an irreversible
            // external intent. The next phase repeats all admission/lease guards.
            await registration.verifyPreconditions(domainStep, {
              ...loaded.context,
              executionStepId: step.id,
            });
            return {
              kind: DELETION_REQUIRED as typeof DELETION_REQUIRED,
              proof: {
                executionStepId: step.id,
                preferenceId: conversationId(
                  String(domainStep.commandTemplate.id),
                ),
              },
              deletedAt: now.toISOString(),
            };
          }
          const result = await this.effect.execute(
            {
              ...domainStep,
              outputBindings: [],
              publicStep: {
                ...domainStep.publicStep,
                depends_on: [],
                output_bindings: [],
              },
            },
            {
              ...loaded.context,
              executionStepId: step.id,
              ...(deletingPreference && deletionProof
                ? { [NODIA_AI_DELETION_PROOF]: deletionProof }
                : {}),
            },
          );
          now = await this.store.now(manager);
          if (now.getTime() >= effectDeadline)
            throw new GoneException('nodia_ai:execution_expired'); // local effect rolls back, too
          if (execution.revision >= 2147483647)
            throw new ConflictException('nodia_ai:execution_limit');
          const receipt = buildNodiaAiLocalReceipt(
            source,
            result,
            (schema, value, persisted) =>
              this.validate.assert(schema, value, persisted),
          );
          const completedRevision = execution.revision + 1;
          const completeArgs = [
            manager,
            execution,
            step,
            job,
            grant,
            boundHash,
            receipt,
            now,
          ] as const;
          const nextPosition = next + 1 < steps.length ? next + 2 : undefined;
          if (nextPosition !== undefined)
            await this.store.complete(...completeArgs, claim, nextPosition);
          else if (claim) await this.store.complete(...completeArgs, claim);
          else await this.store.complete(...completeArgs);
          const completedState =
            nextPosition === undefined ? 'completed' : 'queued';
          await appendNodiaAiExecutionEvent(manager, {
            conversationId: loaded.chat.id,
            executionId: id,
            eventKey: `execution:${id}:${completedRevision}:${completedState}`,
            payload: {
              revision: completedRevision,
              state: completedState,
              error: null,
            },
            moduleRoutes: modules,
            maxEvents: this.policy.results.outbox_events_per_activity,
          });
          const final = await this.store.execution(manager, id);
          if (!final)
            throw new InternalServerErrorException(
              'nodia_ai:invalid_persisted_state',
            );
          const projected = await this.status.project(
            manager,
            final,
            now,
            loaded.steps,
          );
          if ((await this.store.now(manager)).getTime() >= effectDeadline)
            throw new GoneException('nodia_ai:execution_expired');
          workFinished = true;
          return deletingPreference && deletionProof
            ? {
                kind: DELETION_COMMITTED as typeof DELETION_COMMITTED,
                proof: deletionProof,
                projection: projected,
              }
            : projected;
        };
        return exclusive
          ? withCoreAuthorityLock(
              manager,
              this.policy.timing.read_query_seconds * 1000,
              work,
            )
          : work();
      });
    } catch (error) {
      // Once callback work finished, a transport failure can hide a committed effect.
      // Never retry here: the caller must observe its durable identity first (AI-20).
      if (workFinished && error instanceof QueryFailedError) {
        const driver: unknown = error.driverError;
        const code =
          driver && typeof driver === 'object' && 'code' in driver
            ? driver.code
            : null;
        if (
          typeof code === 'string' &&
          /^(40001|40P01|23[A-Z0-9]{3}|P0001)$/.test(code)
        )
          throw new ConflictException('nodia_ai:execution_conflict');
      }
      if (workFinished)
        throw new ServiceUnavailableException(
          'nodia_ai:execution_result_unknown',
        );
      throw error;
    } finally {
      if (exclusive) await this.effect.invalidateCoreCaches();
    }
  }
}
