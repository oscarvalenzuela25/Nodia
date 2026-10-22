import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { lockAuthority } from '../../authorization/authority-transaction.js';
import type { NodiaAiActorReference } from '../../nodia-ai/types/nodia-ai-authorization.types.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { conversationId } from '../../nodia-ai-conversation/types/conversation-id.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { NodiaAiProposalService } from '../nodia-ai-proposal.service.js';
import { GetNodiaAiProposalUseCase } from './get-nodia-ai-proposal.use-case.js';
import {
  ValidateNodiaAiProposalUseCase,
  storedStep,
} from './validate-nodia-ai-proposal.use-case.js';
import { PrepareNodiaAiProposalUseCase } from './prepare-nodia-ai-proposal.use-case.js';
import { NodiaAiProposalRevision } from '../entities/nodia-ai-proposal-revision.entity.js';
import { NodiaAiProposalStep } from '../entities/nodia-ai-proposal-step.entity.js';
import type { ProposalFieldEdit } from '../types/proposal-preparer.types.js';
import { normalizeNodiaAiProposalInput } from './normalize-nodia-ai-proposal-input.js';
interface ProposalUpdate {
  expected_proposal_revision: number;
  expected_hash: string;
  edits: ProposalFieldEdit[];
}
@Injectable()
export class UpdateNodiaAiProposalUseCase {
  constructor(
    private readonly store: NodiaAiProposalService,
    private readonly get: GetNodiaAiProposalUseCase,
    private readonly validate: ValidateNodiaAiProposalUseCase,
    private readonly prepare: PrepareNodiaAiProposalUseCase,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}
  async execute(identity: NodiaAiActorReference, id: string, input: unknown) {
    const key = conversationId(id);
    const normalized = normalizeNodiaAiProposalInput(
      input,
      'update',
      this.policy.results.json_collection_items,
    );
    this.validate.assert('ProposalUpdateRequest', normalized);
    const command = normalized as ProposalUpdate;
    if (command.edits.length > this.policy.results.json_collection_items)
      throw new BadRequestException('nodia_ai:invalid_input');
    return this.store.transaction(async (manager) => {
      await lockAuthority(
        manager,
        false,
        this.policy.timing.read_query_seconds * 1000,
      );
      const loaded = await this.get.load(manager, identity, key, 'write');
      const { proposal, revision, steps, context, now, chat } = loaded;
      if (
        proposal.current_revision !== command.expected_proposal_revision ||
        revision.hash !== command.expected_hash
      )
        throw new ConflictException('nodia_ai:revision_conflict');
      if (revision.state !== 'ready')
        throw new ConflictException('nodia_ai:proposal_not_ready');
      if (now >= revision.expires_at)
        throw new GoneException('nodia_ai:proposal_expired');
      if (chat.active_job_id)
        throw new ConflictException('nodia_ai:conversation_busy');
      const ids = new Map(steps.map((step) => [step.id, randomUUID()]));
      const edited = new Set<string>();
      for (const edit of command.edits) {
        const pair = `${edit.step_id}:${edit.field_key}`;
        const step = steps.find((item) => item.id === edit.step_id);
        if (
          !step ||
          step.output_bindings.some(
            (binding) => binding.target_field_key === edit.field_key,
          ) ||
          edited.has(pair) ||
          !Object.hasOwn(
            this.validate.preparer(step.tool_name).editableFields,
            edit.field_key,
          )
        )
          throw new BadRequestException('nodia_ai:invalid_input');
        edited.add(pair);
      }
      const next: NodiaAiProposalStep[] = [];
      for (const step of steps) {
        const edits = command.edits.filter((edit) => edit.step_id === step.id);
        const preparer = this.validate.preparer(
          step.tool_name,
          step.contract_hash,
        );
        let prepared = {
          commandTemplate: step.command_template,
          scope: step.scope,
          preconditions: step.preconditions,
          publicStep: step.public_step,
        };
        const bindings = step.output_bindings.map((binding) => ({
          target_field_key: String(binding.target_field_key),
          output_key: String(binding.output_key),
          from_step_id: ids.get(String(binding.from_step_id))!,
          source: storedStep(
            next.find(
              (source) => source.id === ids.get(String(binding.from_step_id)),
            )!,
          ),
        }));
        if (edits.length || bindings.length) {
          const partial = edits.length
            ? await preparer.applyEdits(step.command_template, edits, context)
            : step.command_template;
          if (bindings.length && !preparer.reprepareWithBindings)
            throw new BadRequestException('nodia_ai:catalog_changed');
          const candidate = await (bindings.length
            ? preparer.reprepareWithBindings!(partial, bindings, context)
            : preparer.reprepareStored
              ? preparer.reprepareStored(partial, context)
              : preparer.prepare(partial, context));
          if (candidate.status !== 'ready')
            throw new BadRequestException(
              'nodia_ai:proposal_needs_clarification',
            );
          // Recipient/target may not change through a field-edit channel.
          if (!this.validate.equal(candidate.scope, step.scope))
            throw new BadRequestException('nodia_ai:invalid_input');
          prepared = candidate;
        }
        const dependencies = step.public_step.depends_on;
        const publicBindings = bindings.map(
          ({ source: _source, ...binding }) => binding,
        );
        prepared = {
          ...prepared,
          publicStep: {
            ...prepared.publicStep,
            depends_on: Array.isArray(dependencies)
              ? dependencies.map((dep) => ids.get(String(dep))!)
              : [],
            output_bindings: publicBindings,
          },
        };
        next.push(
          this.prepare.step(
            proposal.id,
            revision.revision + 1,
            step.position,
            step.tool_name,
            step.contract_hash,
            prepared,
            ids.get(step.id),
          ),
        );
      }
      const nextRevision = Object.assign(new NodiaAiProposalRevision(), {
        proposal_id: proposal.id,
        revision: revision.revision + 1,
        state: 'ready',
        hash: '',
        catalog_version: revision.catalog_version,
        canonicalization_version: revision.canonicalization_version,
        created_at: now,
        expires_at: new Date(
          Math.min(chat.expires_at.getTime(), revision.expires_at.getTime()),
        ),
      });
      const projection: NodiaAiJsonObject = this.validate.compile(
        proposal,
        nextRevision,
        next,
        false,
      );
      nextRevision.hash = String(projection.hash);
      await this.store.advance(manager, proposal, nextRevision, next);
      await this.store.publishReady(
        manager,
        proposal,
        projection,
        [
          ...new Set(
            next.flatMap(
              (step) =>
                this.validate.preparer(step.tool_name, step.contract_hash)
                  .moduleRoutes,
            ),
          ),
        ],
        this.policy.results.outbox_events_per_activity,
      );
      return projection;
    });
  }
}
