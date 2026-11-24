import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { ApiTextGenerationService } from '../../ai-generation/api-text-generation.service.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import type { UpdateNodiaCvDraftDto } from '../dto/nodia-cv-draft.dto.js';
import type {
  NodiaCvSelectionDto,
  StartNodiaCvGenerationDto,
} from '../dto/nodia-cv-generation.dto.js';
import {
  CV_TAILORING_PROMPT_VERSION,
  CV_TAILORING_PURPOSE,
  CvTailoringError,
  prepareCvTailoring,
} from '../engine/index.js';
import { NodiaCvGenerationScope } from '../nodia-cv-generation-scope.service.js';
import { NodiaCvGenerationStore } from '../nodia-cv-generation.store.js';
import {
  NodiaCvProfilesService,
  profileSummary,
} from '../nodia-cv-profiles.service.js';
import { NodiaCvSelectionService } from '../nodia-cv-selection.service.js';
import { prepareCvDraftReview } from '../policies/nodia-cv-draft-review.js';
import { cvGenerationError } from '../policies/nodia-cv-generation-errors.js';
import {
  CV_PROBE_CANDIDATE,
  CV_PROBE_OFFER,
  cvGenerationIntent,
  cvGenerationPrompt,
} from '../policies/nodia-cv-generation.js';
import type { CvGenerationRow } from '../types/nodia-cv-generation.types.js';

function visibleGeneration(row: CvGenerationRow) {
  if (
    row.state === 'expired' ||
    !row.profile_id ||
    row.expires_at.getTime() <= Date.now()
  )
    cvGenerationError('generation_expired', 410);
  return {
    id: row.id,
    state: row.state,
    profile_id: row.profile_id,
    profile_revision: row.profile_revision,
    language: row.language,
    selection: row.selection_snapshot,
    created_at: row.created_at,
    expires_at: row.expires_at,
    vacancy_title: row.vacancy_title,
    vacancy_company: row.vacancy_company,
    error_code: row.error_code,
    draft: row.draft,
    review:
      row.review && row.review_revision !== null
        ? {
            revision: row.review_revision,
            included_fact_ids: row.review.included_fact_ids,
            evidence: row.review.evidence,
          }
        : null,
  };
}

@Injectable()
export class NodiaCvGenerationsUseCase {
  constructor(
    private readonly scope: NodiaCvGenerationScope,
    private readonly store: NodiaCvGenerationStore,
    private readonly profiles: NodiaCvProfilesService,
    private readonly selections: NodiaCvSelectionService,
    private readonly api: ApiTextGenerationService,
    @Inject(NODIA_AI_RUNTIME_POLICY)
    private readonly policy: NodiaAiRuntimePolicy,
  ) {}

  catalog(actor: ActorReference, after?: string) {
    return this.scope.transaction(async (manager) => {
      await this.scope.authorize(manager, actor);
      return this.selections.catalog(manager, after);
    });
  }

  eligibility(actor: ActorReference, selection: NodiaCvSelectionDto) {
    return this.scope.transaction(async (manager) => {
      await this.scope.authorize(manager, actor);
      return this.selections.eligibility(manager, selection);
    });
  }

  status(actor: ActorReference, id: string) {
    return this.read(actor, { id }, visibleGeneration);
  }

  statusByRequest(actor: ActorReference, key: string) {
    return this.read(actor, { key }, (row) => {
      const visible = visibleGeneration(row);
      if (!row.offer_text || !row.profile_snapshot)
        cvGenerationError('request_failed', 500);
      return {
        ...visible,
        recovery: {
          offer_text: row.offer_text,
          profile: row.profile_snapshot,
        },
      };
    });
  }

  private read<T>(
    actor: ActorReference,
    reference: { id: string } | { key: string },
    project: (row: CvGenerationRow) => T,
  ) {
    return this.scope.transaction(async (manager) => {
      const current = await this.scope.authorize(manager, actor);
      const row = await this.store.status(manager, current.actorId, reference);
      if (!row || (row.qualification && !current.isSuperAdmin))
        cvGenerationError('generation_not_found', 404);
      return project(row);
    });
  }

  updateDraft(actor: ActorReference, id: string, input: UpdateNodiaCvDraftDto) {
    return this.scope.transaction(async (manager) => {
      const current = await this.scope.authorize(manager, actor);
      const row = await this.store.status(
        manager,
        current.actorId,
        { id },
        true,
      );
      if (!row || row.qualification)
        cvGenerationError('generation_not_found', 404);
      const visible = visibleGeneration(row);
      if (visible.state !== 'ready' || !visible.draft || !visible.review)
        cvGenerationError('draft_not_ready');
      if (visible.review.revision !== input.revision)
        cvGenerationError('stale_draft');

      const review = prepareCvDraftReview(visible.draft, input);
      const updated = await this.store.updateReview(
        manager,
        current.actorId,
        id,
        input.revision,
        review,
      );
      if (!updated) cvGenerationError('generation_expired', 410);
      return visibleGeneration(updated);
    });
  }

  start(actor: ActorReference, input: StartNodiaCvGenerationDto) {
    return this.admit(actor, input, false);
  }

  /** Internal synthetic canary. There is deliberately no HTTP handler for admission of a probe. */
  startProbe(actor: ActorReference, input: StartNodiaCvGenerationDto) {
    return this.admit(actor, input, true);
  }

  private admit(
    actor: ActorReference,
    input: StartNodiaCvGenerationDto,
    qualification: boolean,
  ) {
    const requestHash = cvGenerationIntent(input);
    return this.scope.transaction(async (manager) => {
      const current = await this.scope.authorize(manager, actor);
      if (qualification && !current.isSuperAdmin)
        cvGenerationError('generation_probe_forbidden', 403);
      const previous = await this.store.status(manager, current.actorId, {
        key: input.request_key,
      });
      if (previous) {
        const visible = visibleGeneration(previous);
        if (
          previous.request_hash !== requestHash ||
          previous.qualification !== qualification
        )
          cvGenerationError('request_key_conflict');
        return visible;
      }

      const profile = await this.profiles.find(
        manager,
        input.profile_id,
        current.actorId,
        'read',
      );
      if (!profile) cvGenerationError('profile_not_found', 404);
      if (profile.revision !== input.profile_revision)
        cvGenerationError('stale_profile');
      if (
        qualification &&
        (input.offer_text !== CV_PROBE_OFFER ||
          input.language !== 'en' ||
          profile.full_name !== CV_PROBE_CANDIDATE ||
          profile.data.main_stack.join(',') !== 'TypeScript')
      )
        cvGenerationError('generation_probe_invalid', 400);

      const snapshot = { ...profileSummary(profile), ...profile.data };
      try {
        const prepared = prepareCvTailoring({
          profile: snapshot,
          offer: input.offer_text,
          locale: input.language,
        });
        const measured = this.api.measure(cvGenerationPrompt(prepared));
        if (measured.utf8Bytes > measured.maximumUtf8Bytes)
          cvGenerationError('generation_input_too_large', 413);
      } catch (error) {
        if (error instanceof CvTailoringError)
          cvGenerationError(
            error.code === 'input_too_large'
              ? 'generation_input_too_large'
              : 'generation_invalid_input',
            400,
          );
        throw error;
      }

      await this.store.checkQueue(manager, current.actorId, this.policy);
      const config = await this.selections.configure(input.selection, manager);
      const scopeHash = this.selections.scopeHash(input.selection, config);
      if (
        !qualification &&
        !(await this.selections.qualified(manager, scopeHash))
      )
        cvGenerationError('generation_selection_unqualified');
      return visibleGeneration(
        await this.store.admit(manager, {
          id: randomUUID(),
          owner: current.actorId,
          sessionId: current.sessionId,
          input,
          profile: snapshot,
          config,
          scopeHash,
          requestHash,
          purposeVersion: CV_TAILORING_PURPOSE,
          promptVersion: CV_TAILORING_PROMPT_VERSION,
          qualification,
          waitSeconds: this.policy.queue.wait_seconds,
        }),
      );
    }, true);
  }
}
