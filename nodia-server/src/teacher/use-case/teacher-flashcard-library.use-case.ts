import { HttpException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import {
  FlashcardLibraryStore,
  type FlashcardLibraryProposal,
} from '../../ai-generation/flashcard-library.store.js';
import { FlashcardLibraryTransport } from '../../ai-generation/flashcard-library-transport.service.js';
import type { FlashcardLibraryEligibilityDto } from '../dto/teacher-flashcard-library.dto.js';
import {
  flashcardLibraryImagePrompt,
  flashcardLibraryTextPrompt,
  readFlashcardLibraryRequest,
} from '../policies/teacher-flashcard-library.js';
import {
  hash,
  requireUuid,
  selection,
  teacherError,
} from '../policies/teacher-validation.js';
import { TeacherService } from '../teacher.service.js';
import { requireFlashcardLibraryTarget } from './teacher-flashcard-library-target.js';

const availabilityErrors = [
  'flashcard_image_unqualified',
  'flashcard_image_effort_unsupported',
  'flashcard_library_configuration_unavailable',
];

@Injectable()
export class TeacherFlashcardLibraryUseCase {
  constructor(
    private readonly teacher: TeacherService,
    private readonly store: FlashcardLibraryStore,
    private readonly transport: FlashcardLibraryTransport,
  ) {}

  generate(actor: ActorReference, body: unknown) {
    const { key, ...input } = readFlashcardLibraryRequest(body);
    const origin =
      input.origin.kind === 'notes' ? { kind: 'notes' } : input.origin;
    return this.teacher.scope(
      actor,
      null,
      async ({ manager, actor: current }) => {
        const material = await requireFlashcardLibraryTarget(
          manager,
          current.actorId,
          origin,
        );
        if (input.origin.kind === 'notes') material.notes = input.origin.notes;
        const currentCard = material.current_card;
        return this.store.admit(manager, {
          id: randomUUID(),
          owner: current.actorId,
          authSession: current.sessionId,
          requestKey: key,
          requestHash: hash(input),
          origin,
          textSelection: input.textSelection,
          imageSelection: input.imageSelection,
          textPrompt: input.textSelection
            ? flashcardLibraryTextPrompt(material)
            : null,
          imagePrompt:
            input.parts === 'image' && currentCard
              ? flashcardLibraryImagePrompt(
                  currentCard.question,
                  currentCard.answer,
                )
              : null,
        });
      },
      true,
    );
  }

  eligibility(actor: ActorReference, query: FlashcardLibraryEligibilityDto) {
    const { kind, ...input } = query;
    const selected = selection({
      ...input,
      effort_id: input.effort_id ?? null,
    });
    return this.teacher.scope(actor, null, async ({ manager }) => {
      if (selected.mode !== 'api_key') {
        return {
          eligible: false,
          reason_code: 'flashcard_library_mode_unsupported',
          selection: selected,
        };
      }
      try {
        await this.transport.configure(selected, kind, manager);
        return { eligible: true, reason_code: null, selection: selected };
      } catch (error: unknown) {
        const response =
          error instanceof HttpException ? error.getResponse() : null;
        const reason =
          response &&
          typeof response === 'object' &&
          'code' in response &&
          typeof response.code === 'string' &&
          availabilityErrors.includes(response.code)
            ? response.code
            : 'provider_unavailable';
        return { eligible: false, reason_code: reason, selection: selected };
      }
    });
  }

  byId(actor: ActorReference, id: string) {
    return this.teacher.scope(
      actor,
      null,
      async ({ manager, actor: current }) =>
        this.project(
          manager,
          current.actorId,
          await this.store.byId(manager, current.actorId, requireUuid(id)),
        ),
    );
  }

  byRequest(actor: ActorReference, requestKey: string) {
    return this.teacher.scope(
      actor,
      null,
      async ({ manager, actor: current }) =>
        this.project(
          manager,
          current.actorId,
          await this.store.byRequest(
            manager,
            current.actorId,
            requireUuid(requestKey),
          ),
        ),
    );
  }

  image(actor: ActorReference, id: string) {
    return this.teacher.scope(
      actor,
      null,
      async ({ manager, actor: current }) => {
        const image = await this.store.image(
          manager,
          current.actorId,
          requireUuid(id),
        );
        if (!image) teacherError('not_found', 404);
        await requireFlashcardLibraryTarget(
          manager,
          current.actorId,
          image.origin,
        );
        return { bytes: image.bytes, mime: image.mime };
      },
    );
  }

  private async project(
    manager: EntityManager,
    owner: string,
    proposal: FlashcardLibraryProposal | null,
  ) {
    if (!proposal) teacherError('not_found', 404);
    await requireFlashcardLibraryTarget(manager, owner, proposal.origin);
    return {
      id: proposal.id,
      text: proposal.text,
      image: {
        state: proposal.image.state,
        error_code: proposal.image.error_code,
      },
      expires_at: proposal.expires_at,
    };
  }
}
