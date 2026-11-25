import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { readFlashcardGenerationRequest } from '../policies/teacher-flashcard-generation.js';
import {
  hash,
  requireUuid,
  teacherError,
} from '../policies/teacher-validation.js';
import { TeacherService } from '../teacher.service.js';
import {
  TEACHER_GENERATION_PORT,
  type TeacherGenerationJob,
  type TeacherGenerationPort,
} from '../types/teacher.types.js';
import {
  flashcardLessonCard,
  requireFlashcardGenerationTarget,
} from './teacher-flashcard-generation-persistence.js';
import { admitTeacherGeneration } from './teacher-generation-admission.js';

const operation = 'flashcard_text';
type GenerationRow = Pick<
  TeacherGenerationJob,
  'id' | 'state' | 'session_id' | 'input_snapshot' | 'result_ref' | 'error_code'
>;

@Injectable()
export class TeacherFlashcardGenerationUseCase {
  constructor(
    private readonly teacher: TeacherService,
    @Inject(TEACHER_GENERATION_PORT)
    private readonly generation: TeacherGenerationPort,
  ) {}

  async generate(actor: ActorReference, body: unknown) {
    const input = readFlashcardGenerationRequest(body);
    const source = input.card
      ? await this.teacher.scope(
          actor,
          null,
          async ({ manager, actor: current }) =>
            (await flashcardLessonCard(manager, current.actorId, input.card))
              .source,
        )
      : input.source;
    return this.teacher.command(
      actor,
      source.session_id,
      input.key,
      operation,
      { source, card: input.card ?? null, selection: input.selection },
      async (scope) => {
        const { manager, actor: current, session } = scope;
        if (!session || session.owner_user_id !== current.actorId)
          teacherError('not_found', 404);
        if (!session.selection) teacherError('no_model');
        if (hash(session.selection) !== hash(input.selection))
          teacherError('configuration_changed');
        const existing = input.card
          ? await flashcardLessonCard(manager, current.actorId, input.card)
          : null;
        const snapshot = {
          source,
          ...(existing && {
            card: input.card,
            existing_card: {
              question: existing.question,
              answer: existing.answer,
            },
          }),
        };
        await requireFlashcardGenerationTarget(
          manager,
          session.id,
          current.actorId,
          snapshot,
        );
        const job = await admitTeacherGeneration(
          scope,
          this.generation,
          operation,
          snapshot,
          {},
        );
        return {
          status: 202,
          receipt: {
            id: job.job_id,
            state: 'queued',
            error_code: null,
            proposal: null,
          },
        };
      },
    );
  }

  status(actor: ActorReference, id: string) {
    return this.teacher.scope(actor, null, ({ manager, actor: current }) =>
      this.read(manager, current.actorId, requireUuid(id)),
    );
  }

  statusByRequest(actor: ActorReference, key: string) {
    return this.teacher.scope(
      actor,
      null,
      async ({ manager, actor: current }) => {
        const [receipt]: { id: string }[] = await manager.query(
          "SELECT receipt->>'id' AS id FROM teacher_requests WHERE actor_id=$1 AND request_key=$2 AND operation=$3",
          [current.actorId, requireUuid(key), operation],
        );
        if (!receipt) teacherError('not_found', 404);
        return this.read(manager, current.actorId, receipt.id);
      },
    );
  }

  private async read(manager: EntityManager, owner: string, id: string) {
    const [job]: GenerationRow[] = await manager.query(
      `SELECT j.id,j.state,j.session_id,j.input_snapshot,j.result_ref,j.error_code
       FROM teacher_generation_jobs j JOIN teacher_sessions s ON s.id=j.session_id
       WHERE j.id=$1 AND j.actor_id=$2 AND s.owner_user_id=$2 AND j.purpose=$3
       FOR SHARE OF s`,
      [id, owner, operation],
    );
    if (!job) teacherError('not_found', 404);
    if (job.state === 'ready')
      await requireFlashcardGenerationTarget(
        manager,
        job.session_id,
        owner,
        job.input_snapshot,
      );
    return {
      id: job.id,
      state: job.state,
      error_code: job.error_code,
      proposal:
        job.state === 'ready' ? (job.result_ref?.proposal ?? null) : null,
    };
  }
}
