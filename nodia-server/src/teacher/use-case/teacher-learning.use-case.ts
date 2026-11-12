import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { TeacherService } from '../teacher.service.js';
import { learningMetadata } from '../policies/teacher-learning.js';
import {
  assessment,
  object,
  requireUuid,
  teacherError,
  text,
} from '../policies/teacher-validation.js';
import type { PlanOutline, BlueprintSlot } from '../types/teacher.types.js';
import type { LearningDimension } from '../types/teacher-learning.types.js';
import type {
  LearningBlueprintDto,
  LearningMappingDto,
  LearningMetadataDto,
  LearningInteractionDto,
} from '../dto/teacher-learning.dto.js';
import { learningSnapshot } from './teacher-learning-persistence.js';

@Injectable()
export class TeacherLearningUseCase {
  constructor(private readonly store: TeacherService) {}
  read(actor: ActorReference, id: string) {
    return this.store.scope(actor, id, ({ manager, session }) =>
      learningSnapshot(manager, session!),
    );
  }
  execute(
    actor: ActorReference,
    id: string,
    key: string,
    operation: 'blueprint' | 'mapping' | 'metadata' | 'interaction',
    body:
      | LearningBlueprintDto
      | LearningMappingDto
      | LearningMetadataDto
      | LearningInteractionDto,
  ) {
    return this.store.command(
      actor,
      id,
      key,
      `learning_${operation}`,
      body,
      async ({ manager: m, session: s, actor: current }) => {
        if (!s) teacherError('not_found', 404);
        if (s.state === 'paused' || s.state === 'archived')
          teacherError(
            s.state === 'paused' ? 'session_paused' : 'session_archived',
          );
        if (s.revision !== body.expected_session_revision)
          teacherError('revision_conflict');
        let extra: Record<string, unknown> = {};
        if (operation === 'blueprint') {
          const b = body as LearningBlueprintDto;
          const dimensions: LearningDimension[] = b.dimensions.map((raw) => {
            const d = object(raw, ['id', 'description']);
            return {
              id: requireUuid(d.id),
              description: text(d.description, 1, 2000),
            };
          });
          if (new Set(dimensions.map((d) => d.id)).size !== dimensions.length)
            teacherError('invalid_input', 400);
          const slots: BlueprintSlot[] = b.items.map((raw, i) => {
            const v = object(raw, [
              'dimension_id',
              'kind',
              'prompt',
              'options',
              'private_key',
              'explanation',
            ]);
            if (
              !dimensions.some((d) => d.id === v.dimension_id) ||
              !['single_choice', 'completion'].includes(String(v.kind))
            )
              teacherError('invalid_input', 400);
            return {
              ordinal: i + 1,
              objective_id: requireUuid(v.dimension_id),
              kind: v.kind as 'single_choice' | 'completion',
              max_points: 2,
            };
          });
          if (
            dimensions.some(
              (d) => !slots.some((slot) => slot.objective_id === d.id),
            )
          )
            teacherError('invalid_input', 400);
          const parsed = assessment(
            {
              schema_version: 1,
              scope: 'diagnostic',
              plan_revision_id: null,
              section_id: null,
              unit_id: null,
              items: b.items.map((raw, i) => {
                const v = raw as Record<string, unknown>;
                return {
                  local_ref: String(i + 1),
                  objective_id: v.dimension_id,
                  kind: v.kind,
                  prompt: v.prompt,
                  ...(v.options ? { options: v.options } : {}),
                  private_key: v.private_key,
                  explanation: v.explanation,
                };
              }),
            },
            slots,
            {
              scope: 'diagnostic',
              plan_revision_id: null,
              section_id: null,
              unit_id: null,
            },
          );
          const [last]: { n: number }[] = await m.query(
            'SELECT coalesce(max(revision),0)::integer AS n FROM teacher_learning_blueprints WHERE session_id=$1',
            [id],
          );
          const bankId = randomUUID();
          const items = parsed.items.map((item) => ({
            dimension_id: item.objective_id,
            kind: item.kind,
            prompt: item.prompt,
            ...(item.options ? { options: item.options } : {}),
            private_key: item.private_key,
            explanation: item.explanation,
          }));
          await m.query(
            'INSERT INTO teacher_learning_blueprints(id,session_id,revision,title,dimensions,items,reviewed,reviewed_by_actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              bankId,
              id,
              last.n + 1,
              text(b.title, 1, 160),
              JSON.stringify(dimensions),
              JSON.stringify(items),
              b.reviewed,
              b.reviewed ? current.actorId : null,
            ],
          );
          extra = { resource_id: bankId, blueprint_id: bankId };
        } else if (operation === 'mapping') {
          const b = body as LearningMappingDto;
          const [bank]: { dimensions: LearningDimension[] }[] = await m.query(
            'SELECT dimensions FROM teacher_learning_blueprints WHERE session_id=$1 AND id=$2',
            [id, b.blueprint_id],
          );
          const [plan]: { outline: PlanOutline; state: string }[] =
            await m.query(
              'SELECT outline,state FROM teacher_plan_revisions WHERE session_id=$1 AND id=$2',
              [id, b.plan_revision_id],
            );
          const objective = plan?.outline.sections.some((section) =>
            section.objectives.some((o) => o.id === b.objective_id),
          );
          if (
            !bank ||
            !bank.dimensions.some((d) => d.id === b.dimension_id) ||
            !objective ||
            !['draft', 'candidate', 'accepted'].includes(plan.state)
          )
            teacherError('invalid_input', 400);
          await m.query(
            'INSERT INTO teacher_learning_mappings(session_id,blueprint_id,dimension_id,plan_revision_id,objective_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',
            [
              id,
              b.blueprint_id,
              b.dimension_id,
              b.plan_revision_id,
              b.objective_id,
            ],
          );
        } else if (operation === 'metadata') {
          const b = body as LearningMetadataDto;
          const [r]: {
            revision: number;
            submitted_at: Date | null;
            state: string;
            is_active: boolean;
          }[] = await m.query(
            'SELECT r.revision,r.submitted_at,a.state,a.is_active FROM teacher_responses r JOIN teacher_attempts a ON a.id=r.attempt_id WHERE r.session_id=$1 AND r.id=$2 FOR UPDATE OF r,a',
            [id, b.response_id],
          );
          if (!r) teacherError('not_found', 404);
          if (r.revision !== b.expected_response_revision)
            teacherError('revision_conflict');
          if (r.submitted_at || r.state !== 'in_progress' || !r.is_active)
            teacherError('response_already_submitted');
          const metadata = learningMetadata(b.self_explanation, b.confidence);
          await m.query(
            'UPDATE teacher_responses SET self_explanation=$2,confidence=$3,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',
            [b.response_id, metadata.self_explanation, metadata.confidence],
          );
          extra = {
            resource_id: b.response_id,
            response_revision: r.revision + 1,
          };
        } else {
          const b = body as LearningInteractionDto;
          const [content]: { public_blocks: { id: string; kind: string }[] }[] =
            await m.query(
              "SELECT public_blocks FROM teacher_content_versions WHERE session_id=$1 AND id=$2 AND plan_revision_id=$3 AND publication_state='current'",
              [id, b.content_version_id, s.current_plan_revision_id],
            );
          if (!content?.public_blocks.some((block) => block.id === b.block_id && block.kind === b.kind))
            teacherError('not_found', 404);
          const [final]: { blocked: boolean }[] = await m.query(
            "SELECT EXISTS(SELECT 1 FROM teacher_attempts WHERE session_id=$1 AND scope='section_final' AND is_active) AS blocked",
            [id],
          );
          if (final.blocked) teacherError('final_requires_full_submit');
          const interactionId = randomUUID();
          await m.query(
            'INSERT INTO teacher_learning_interactions(id,session_id,content_version_id,block_id,kind,text) VALUES($1,$2,$3,$4,$5,$6)',
            [
              interactionId,
              id,
              b.content_version_id,
              b.block_id,
              b.kind,
              text(b.text, 1, 2000),
            ],
          );
          extra = { resource_id: interactionId };
        }
        const [updated]: { revision: number }[] = await m.query(
          'WITH updated AS (UPDATE teacher_sessions SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING revision) SELECT revision FROM updated',
          [id],
        );
        return {
          status: 200,
          receipt: { session_id: id, revision: updated.revision, ...extra },
        };
      },
    );
  }
}
