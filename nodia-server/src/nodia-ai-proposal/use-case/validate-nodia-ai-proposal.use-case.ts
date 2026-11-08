import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ValidateFunction } from 'ajv';
import { createHash } from 'node:crypto';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { compileNodiaAiToolSchema } from '../../nodia-ai-tools/use-case/nodia-ai-tool-registry.use-case.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import {
  NODIA_AI_PROPOSAL_PREPARERS,
  NODIA_AI_HISTORICAL_PROPOSAL_READERS,
  type NodiaAiProposalPreparer,
  type StoredProposalStep,
} from '../types/proposal-preparer.types.js';
import type { NodiaAiProposal } from '../entities/nodia-ai-proposal.entity.js';
import type { NodiaAiProposalRevision } from '../entities/nodia-ai-proposal-revision.entity.js';
import type { NodiaAiProposalStep } from '../entities/nodia-ai-proposal-step.entity.js';
import { CanonicalizeNodiaAiProposalUseCase } from './canonicalize-nodia-ai-proposal.use-case.js';
import { NODIA_AI_WORKFLOW_CATALOG_VERSION } from '../types/workflow.types.js';
export const NODIA_AI_PROPOSAL_COMMON_SCHEMA = Symbol(
  'NODIA_AI_PROPOSAL_COMMON_SCHEMA',
);
export function storedStep(row: NodiaAiProposalStep): StoredProposalStep {
  return {
    id: row.id,
    toolName: row.tool_name,
    contractHash: row.contract_hash,
    position: row.position,
    commandTemplate: row.command_template,
    scope: row.scope,
    preconditions: row.preconditions,
    publicStep: row.public_step,
    outputBindings: row.output_bindings,
  };
}
@Injectable()
export class ValidateNodiaAiProposalUseCase {
  private readonly schemas = new Map<string, ValidateFunction>();
  private readonly preparers = new Map<string, NodiaAiProposalPreparer>();
  private readonly historicalReaders = new Map<
    string,
    NodiaAiProposalPreparer
  >();
  constructor(
    @Inject(NODIA_AI_PROPOSAL_PREPARERS)
    preparers: readonly NodiaAiProposalPreparer[],
    @Inject(NODIA_AI_PROPOSAL_COMMON_SCHEMA) source: string,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
    private readonly canonical: CanonicalizeNodiaAiProposalUseCase,
    @Optional()
    @Inject(NODIA_AI_HISTORICAL_PROPOSAL_READERS)
    historicalReaders: readonly NodiaAiProposalPreparer[] = [],
  ) {
    for (const reader of historicalReaders) {
      if (
        !reader.verifyHistoricalReadAuthority ||
        this.historicalReaders.has(reader.toolName)
      )
        throw new Error('nodia_ai:invalid_historical_reader');
      this.historicalReaders.set(reader.toolName, reader);
    }
    for (const preparer of preparers) {
      if (
        this.preparers.has(preparer.toolName) ||
        !/^[a-f0-9]{64}$/.test(preparer.contractHash)
      )
        throw new Error('nodia_ai:invalid_proposal_preparer');
      this.preparers.set(preparer.toolName, preparer);
    }
    for (const definition of [
      'PublicProposal',
      'PublicStep',
      'PreparationResult',
      'ProposalUpdateRequest',
      'ProposalCancelRequest',
      'FinancialMovementReceipt',
      'FinancialEffectReceipt',
      'BusinessEffectReceipt',
      'RentalEffectReceipt',
      'CoreEffectReceipt',
      'AiProviderEffectReceipt',
      'PreferenceEffectReceipt',
      'SecureFlowReceipt',
      'WorkflowPrepareInput',
      'RemainingWorkflowPrepareInput',
    ]) {
      this.schemas.set(
        definition,
        compileNodiaAiToolSchema({
          sourceJson: source,
          definition,
          sha256: createHash('sha256').update(source).digest('hex'),
        }).validate,
      );
    }
  }
  preparer(name: string, hash?: string) {
    const registered = this.preparers.get(name);
    if (!registered || (hash !== undefined && registered.contractHash !== hash))
      throw new BadRequestException('nodia_ai:catalog_changed');
    return registered;
  }
  equal(left: unknown, right: unknown) {
    return this.canonical.execute(left) === this.canonical.execute(right);
  }
  hash(value: unknown) {
    return createHash('sha256')
      .update(this.canonical.execute(value))
      .digest('hex');
  }
  assert(definition: string, value: unknown, stored = false) {
    let text: string;
    try {
      text = this.canonical.execute(value);
    } catch (error) {
      if (stored)
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      throw error;
    }
    if (
      Buffer.byteLength(text) > this.policy.results.tool_result_utf8_bytes ||
      !this.schemas.get(definition)?.(value)
    ) {
      if (stored)
        throw new InternalServerErrorException(
          'nodia_ai:invalid_persisted_state',
        );
      throw new BadRequestException('nodia_ai:invalid_input');
    }
  }
  compile(
    proposal: NodiaAiProposal,
    revision: NodiaAiProposalRevision,
    steps: readonly NodiaAiProposalStep[],
    verifyHash = true,
  ): NodiaAiJsonObject {
    return this.compileSnapshot(proposal, revision, steps, verifyHash, false);
  }
  isCompatible(
    revision: NodiaAiProposalRevision,
    steps: readonly NodiaAiProposalStep[],
  ) {
    return steps.every((step) => {
      const preparer = this.preparers.get(step.tool_name);
      return (
        preparer?.contractHash === step.contract_hash &&
        (preparer.catalogVersion === revision.catalog_version ||
          revision.catalog_version === NODIA_AI_WORKFLOW_CATALOG_VERSION)
      );
    });
  }
  historicalPreparer(name: string) {
    const preparer = this.historicalReaders.get(name) ?? this.preparer(name);
    if (!preparer.verifyHistoricalReadAuthority)
      throw new BadRequestException('nodia_ai:catalog_changed');
    return preparer;
  }
  /** Frozen schema/hash validation only; callers must reauthorize through the explicit historical port. */
  compileHistorical(
    proposal: NodiaAiProposal,
    revision: NodiaAiProposalRevision,
    steps: readonly NodiaAiProposalStep[],
  ) {
    return this.compileSnapshot(proposal, revision, steps, true, true);
  }
  private compileSnapshot(
    proposal: NodiaAiProposal,
    revision: NodiaAiProposalRevision,
    steps: readonly NodiaAiProposalStep[],
    verifyHash: boolean,
    historical: boolean,
  ): NodiaAiJsonObject {
    const invalid = (): never => {
      throw new InternalServerErrorException(
        'nodia_ai:invalid_persisted_state',
      );
    };
    if (
      !steps.length ||
      steps.length > this.policy.budget.steps_per_proposal ||
      revision.proposal_id !== proposal.id ||
      revision.canonicalization_version !== 'jcs-rfc8785/1'
    )
      invalid();
    const prior = new Map<string, NodiaAiProposalStep>();
    for (const [index, step] of steps.entries()) {
      const registration = historical
        ? this.historicalPreparer(step.tool_name)
        : this.preparer(step.tool_name, step.contract_hash);
      this.assert('PublicStep', step.public_step, true);
      const changes = step.public_step.changes;
      if (!Array.isArray(changes)) return invalid();
      const fields = new Set<string>();
      for (const value of changes) {
        if (
          !value ||
          typeof value !== 'object' ||
          Array.isArray(value) ||
          typeof value.field_key !== 'string' ||
          fields.has(value.field_key)
        )
          return invalid();
        fields.add(value.field_key);
        if (
          (!value.before_present && value.before !== null) ||
          (!value.after_present && value.after !== null)
        )
          return invalid();
        this.reviewValue(value.before);
        this.reviewValue(value.after);
      }
      if (
        step.position !== index + 1 ||
        step.proposal_id !== proposal.id ||
        step.proposal_revision !== revision.revision ||
        step.public_step.step_id !== step.id ||
        step.public_step.tool_name !== step.tool_name ||
        step.public_step.kind !== step.kind ||
        step.public_step.effect_key !== step.effect_key ||
        this.canonical.execute(step.public_step.scope) !==
          this.canonical.execute(step.scope) ||
        this.canonical.execute(step.public_step.output_bindings) !==
          this.canonical.execute(step.output_bindings) ||
        prior.has(step.id) ||
        (!historical &&
          registration.catalogVersion !== revision.catalog_version &&
          revision.catalog_version !== NODIA_AI_WORKFLOW_CATALOG_VERSION)
      )
        invalid();
      const deps = step.public_step.depends_on;
      // Historical ports currently support independent sealed steps only, never rebinding an old workflow.
      if (
        historical &&
        (step.output_bindings.length || !Array.isArray(deps) || deps.length)
      )
        throw new BadRequestException('nodia_ai:catalog_changed');
      if (
        !Array.isArray(deps) ||
        deps.some((dep) => typeof dep !== 'string' || !prior.has(dep))
      )
        return invalid();
      const targets = new Set<string>();
      for (const binding of step.output_bindings) {
        const sourceId = binding.from_step_id;
        const field = binding.target_field_key;
        const output = binding.output_key;
        if (
          typeof sourceId !== 'string' ||
          typeof field !== 'string' ||
          typeof output !== 'string' ||
          !deps.includes(sourceId) ||
          targets.has(field)
        )
          return invalid();
        const source = prior.get(sourceId);
        if (!source) return invalid();
        const sourceRegistration = this.preparer(
          source.tool_name,
          source.contract_hash,
        );
        if (
          !Object.hasOwn(registration.bindableFields, field) ||
          !Object.hasOwn(sourceRegistration.outputKeys, output) ||
          registration.bindableFields[field] !==
            sourceRegistration.outputKeys[output]
        )
          invalid();
        targets.add(field);
      }
      if (revision.catalog_version === NODIA_AI_WORKFLOW_CATALOG_VERSION) {
        const sources = new Set(
          step.output_bindings.map((binding) => binding.from_step_id),
        );
        if (
          deps.length !== sources.size ||
          deps.some((dep) => !sources.has(dep))
        )
          return invalid();
        for (const target of targets) {
          const change = changes.find(
            (value) =>
              value !== null &&
              typeof value === 'object' &&
              !Array.isArray(value) &&
              value.field_key === target,
          );
          if (
            !change ||
            typeof change !== 'object' ||
            Array.isArray(change) ||
            change.origin !== 'future_step' ||
            change.after_present !== false ||
            change.after !== null
          )
            return invalid();
        }
        if (
          changes.some(
            (value) =>
              value !== null &&
              typeof value === 'object' &&
              !Array.isArray(value) &&
              value.origin === 'future_step' &&
              !targets.has(String(value.field_key)),
          )
        )
          return invalid();
      }
      prior.set(step.id, step);
    }
    const envelope = {
      canonicalization_version: revision.canonicalization_version,
      proposal_id: proposal.id,
      conversation_id: proposal.conversation_id,
      actor_id: proposal.actor_id,
      ...(proposal.prior_execution_id != null
        ? { prior_execution_id: proposal.prior_execution_id }
        : {}),
      revision: revision.revision,
      catalog_version: revision.catalog_version,
      created_at: revision.created_at.toISOString(),
      expires_at: revision.expires_at.toISOString(),
      steps: steps.map((step) => ({
        id: step.id,
        position: step.position,
        tool_name: step.tool_name,
        contract_hash: step.contract_hash,
        kind: step.kind,
        effect_key: step.effect_key,
        scope: step.scope,
        command_template: step.command_template,
        public_step: step.public_step,
        output_bindings: step.output_bindings,
        preconditions: step.preconditions,
      })),
    };
    const hash = createHash('sha256')
      .update(this.canonical.execute(envelope))
      .digest('hex');
    if (verifyHash && hash !== revision.hash) invalid();
    const result: NodiaAiJsonObject = {
      proposal_id: proposal.id,
      revision: revision.revision,
      hash,
      catalog_version: revision.catalog_version,
      state: revision.state,
      steps: steps.map((step) => step.public_step),
      execution_id: null,
      created_at: proposal.created_at.toISOString(),
      expires_at: revision.expires_at.toISOString(),
    };
    this.assert('PublicProposal', result, true);
    return result;
  }
  private reviewValue(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const item = value as NodiaAiJsonObject;
    if (item.kind === 'array' && Array.isArray(item.items)) {
      item.items.forEach((child) => this.reviewValue(child));
    } else if (item.kind === 'object' && Array.isArray(item.fields)) {
      const seen = new Set<string>();
      for (const child of item.fields) {
        if (
          !child ||
          typeof child !== 'object' ||
          Array.isArray(child) ||
          typeof child.field_key !== 'string' ||
          seen.has(child.field_key)
        )
          throw new InternalServerErrorException(
            'nodia_ai:invalid_persisted_state',
          );
        seen.add(child.field_key);
        this.reviewValue(child.value);
      }
    }
  }
}
