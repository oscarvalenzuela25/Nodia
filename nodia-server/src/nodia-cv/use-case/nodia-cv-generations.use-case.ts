import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { ApiTextGenerationService } from '../../ai-generation/api-text-generation.service.js';
import {
  NODIA_AI_RUNTIME_POLICY,
  type NodiaAiRuntimePolicy,
} from '../../nodia-ai-runtime/config/runtime-policy.js';
import { CV_CODEX_HOST_MAX_PROMPT_BYTES } from '../agentic/nodia-cv-codex-wire.js';
import { CV_GEMINI_PROMPT_BYTES } from '../agentic/nodia-cv-agentic-provider.js';
import { cvGeminiGenerationPrompt } from '../agentic/nodia-cv-gemini-transport.js';
import type {
  StartNodiaCvAiEditDto,
  UpdateNodiaCvDraftDto,
} from '../dto/nodia-cv-draft.dto.js';
import type {
  NodiaCvSelectionDto,
  StartNodiaCvGenerationDto,
} from '../dto/nodia-cv-generation.dto.js';
import {
  CV_EDIT_PROMPT_VERSION,
  CV_EDIT_PURPOSE,
  CV_TAILORING_PROMPT_VERSION,
  CV_TAILORING_PURPOSE,
  CvTailoringError,
  prepareCvEdit,
  prepareCvTailoring,
} from '../engine/index.js';
import { minimizeCvText } from '../engine/evidence.js';
import { NodiaCvGenerationScope } from '../nodia-cv-generation-scope.service.js';
import { NodiaCvGenerationStore } from '../nodia-cv-generation.store.js';
import {
  NodiaCvProfilesService,
  profileSummary,
} from '../nodia-cv-profiles.service.js';
import {
  NodiaCvSelectionService,
  type CvAgenticObservation,
} from '../nodia-cv-selection.service.js';
import {
  prepareCvDraftReview,
  requireCvEditBase,
} from '../policies/nodia-cv-draft-review.js';
import { cvGenerationError } from '../policies/nodia-cv-generation-errors.js';
import {
  recoverableGeneration,
  visibleGeneration,
} from '../policies/nodia-cv-generation-status.js';
import {
  CV_PROBE_CANDIDATE,
  CV_PROBE_OFFER,
  cvEditIntent,
  cvGenerationIntent,
  cvGenerationPrompt,
} from '../policies/nodia-cv-generation.js';
import type { CvGenerationRow } from '../types/nodia-cv-generation.types.js';

type Admission =
  | {
      kind: 'generate';
      input: StartNodiaCvGenerationDto;
      qualification: boolean;
    }
  | { kind: 'edit'; input: StartNodiaCvAiEditDto; baseId: string };

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

  async eligibility(actor: ActorReference, selection: NodiaCvSelectionDto) {
    let observation: CvAgenticObservation = null;
    if (selection.mode === 'agentic') {
      await this.scope.transaction((manager) =>
        this.scope.authorize(manager, actor),
      );
      observation = await this.selections.observeAgentic(
        selection,
        AbortSignal.timeout(
          this.policy.timing.provider_dispatch_seconds * 1_000,
        ),
      );
    }
    return this.scope.transaction(async (manager) => {
      await this.scope.authorize(manager, actor);
      return this.selections.eligibility(manager, selection, observation);
    });
  }

  status(actor: ActorReference, id: string) {
    return this.read(actor, { id }, visibleGeneration);
  }

  statusByRequest(actor: ActorReference, key: string) {
    return this.read(actor, { key }, recoverableGeneration);
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

      const review = prepareCvDraftReview(
        visible.draft,
        input,
        visible.review,
        visible.technology_options ?? [],
      );
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
    return this.admit(actor, { kind: 'generate', input, qualification: false });
  }

  /** Internal admin-only canary with designated synthetic inputs. */
  startProbe(actor: ActorReference, input: StartNodiaCvGenerationDto) {
    return this.admit(actor, { kind: 'generate', input, qualification: true });
  }

  startEdit(actor: ActorReference, id: string, input: StartNodiaCvAiEditDto) {
    return this.admit(actor, { kind: 'edit', input, baseId: id.toLowerCase() });
  }

  private async admissionContext(
    manager: EntityManager,
    actor: ActorReference,
    request: Admission,
    requestHash: string,
    qualification: boolean,
    lockBase = false,
  ) {
    const current = await this.scope.authorize(manager, actor);
    if (qualification && !current.isSuperAdmin)
      cvGenerationError('generation_probe_forbidden', 403);
    const previous = await this.store.status(manager, current.actorId, {
      key: request.input.request_key,
    });
    if (previous) {
      const visible = visibleGeneration(previous);
      if (
        previous.request_hash !== requestHash ||
        previous.qualification !== qualification
      ) {
        cvGenerationError('request_key_conflict');
      }
      return { state: 'previous', visible } as const;
    }

    let base = null;
    let input: StartNodiaCvGenerationDto;
    if (request.kind === 'edit') {
      base = requireCvEditBase(
        await this.store.status(
          manager,
          current.actorId,
          { id: request.baseId },
          lockBase,
        ),
        request.input.revision,
      );
      input = {
        request_key: request.input.request_key,
        profile_id: base.profile_id,
        profile_revision: base.profile_revision,
        language: base.language,
        offer_text: base.offer_text,
        vacancy_title: base.vacancy_title ?? undefined,
        vacancy_company: base.vacancy_company ?? undefined,
        selection: request.input.selection,
      };
    } else {
      input = request.input;
    }
    if (base?.source_version) {
      return {
        state: 'new',
        current,
        input,
        base,
        snapshot: base.profile_snapshot,
      } as const;
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
    return {
      state: 'new',
      current,
      input,
      base,
      snapshot: base?.profile_snapshot ?? {
        ...profileSummary(profile),
        ...profile.data,
      },
    } as const;
  }

  private async admit(actor: ActorReference, admission: Admission) {
    const request = structuredClone(admission);
    const qualification = request.kind === 'generate' && request.qualification;
    const requestHash =
      request.kind === 'edit'
        ? cvEditIntent(request.baseId, request.input)
        : cvGenerationIntent(request.input);
    let observation: CvAgenticObservation = null;
    if (request.input.selection.mode === 'agentic') {
      const context = await this.scope.transaction((manager) =>
        this.admissionContext(
          manager,
          actor,
          request,
          requestHash,
          qualification,
        ),
      );
      if (context.state === 'previous') return context.visible;
      observation = await this.selections.observeAgentic(
        request.input.selection,
        AbortSignal.timeout(
          this.policy.timing.provider_dispatch_seconds * 1_000,
        ),
      );
    }
    return this.scope.transaction(async (manager) => {
      const context = await this.admissionContext(
        manager,
        actor,
        request,
        requestHash,
        qualification,
        true,
      );
      if (context.state === 'previous') return context.visible;
      const { current, snapshot, input, base } = context;
      const editInput =
        base && request.kind === 'edit'
          ? {
              base_generation_id: base.id,
              base_revision: request.input.revision,
              instructions: minimizeCvText(snapshot)(
                request.input.instructions,
              ),
            }
          : null;
      try {
        const prepared =
          base && editInput
            ? prepareCvEdit({
                profile: snapshot,
                draft: base.draft,
                review: base.review,
                instructions: editInput.instructions,
              })
            : prepareCvTailoring({
                profile: snapshot,
                offer: input.offer_text,
                locale: input.language,
              });
        const isGemini = observation !== null && 'provider' in observation;
        const prompt = isGemini
          ? cvGeminiGenerationPrompt(prepared)
          : cvGenerationPrompt(prepared);
        const { utf8Bytes, maximumUtf8Bytes } =
          input.selection.mode === 'agentic'
            ? {
                utf8Bytes: Buffer.byteLength(prompt),
                maximumUtf8Bytes: isGemini
                  ? CV_GEMINI_PROMPT_BYTES
                  : CV_CODEX_HOST_MAX_PROMPT_BYTES,
              }
            : this.api.measure(prompt);
        if (utf8Bytes > maximumUtf8Bytes)
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

      if (
        editInput &&
        (await this.store.hasUnresolvedEdit(
          manager,
          current.actorId,
          requestHash,
        ))
      )
        cvGenerationError('edit_in_progress');
      await this.store.checkQueue(manager, current.actorId, this.policy);
      const config =
        input.selection.mode === 'agentic'
          ? await this.selections.configureAgentic(
              input.selection,
              manager,
              observation,
            )
          : await this.selections.configure(input.selection, manager);
      return visibleGeneration(
        await this.store.admit(manager, {
          id: randomUUID(),
          owner: current.actorId,
          sessionId: current.sessionId,
          input,
          profile: snapshot,
          config,
          scopeHash: this.selections.scopeHash(input.selection, config),
          requestHash,
          purposeVersion: editInput ? CV_EDIT_PURPOSE : CV_TAILORING_PURPOSE,
          promptVersion: editInput
            ? CV_EDIT_PROMPT_VERSION
            : CV_TAILORING_PROMPT_VERSION,
          qualification,
          waitSeconds: this.policy.queue.wait_seconds,
          editInput,
          baseExpiresAt: base?.expires_at ?? null,
          sourceVersion: base?.source_version ?? null,
        }),
      );
    }, true);
  }
}
