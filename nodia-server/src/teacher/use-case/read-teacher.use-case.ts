import { stableOptions } from '../policies/teacher-learning.js';
import { Inject, Injectable } from '@nestjs/common';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { TeacherService } from '../teacher.service.js';
import {
  TEACHER_GENERATION_PORT,
  type TeacherGenerationPort,
  type TeacherGenerationJob,
  type TeacherSelection,
  type TeacherAnswer,
  type PlanOutline,
} from '../types/teacher.types.js';
import { actions, sessionActions } from '../policies/teacher-actions.js';
import { requireUuid, teacherError } from '../policies/teacher-validation.js';
import type { GetTeacherSessionsDto } from '../dto/teacher.dto.js';
import { pendingClosureReason } from './teacher-pending-closure.js';
import { teacherJobActions } from '../policies/teacher-job-actions.js';
import { teacherAnswerStatus } from '../policies/teacher-answer-completeness.js';
import {
  canProjectReinforcement,
  projectReinforcement,
  type ReinforcementGrade,
} from '../policies/teacher-reinforcement.js';
import type { TeacherReinforcementDto } from '../dto/teacher-reinforcement.dto.js';
import { latestSessionJobs } from './teacher-session-jobs.js';

@Injectable()
export class ReadTeacherUseCase {
  constructor(
    private readonly store: TeacherService,
    @Inject(TEACHER_GENERATION_PORT)
    private readonly generation: TeacherGenerationPort,
  ) {}
  connections(actor: ActorReference) {
    return this.generation.connections(actor);
  }
  models(actor: ActorReference, id: string, mode: string, signal?: AbortSignal) {
    return this.generation.models(actor, id, mode, signal);
  }
  eligibility(
    actor: ActorReference,
    id: string,
    selection: Omit<TeacherSelection, 'connection_id'>,
    signal?: AbortSignal,
  ) {
    return this.generation.eligibility(actor, id, selection, signal);
  }
  list(actor: ActorReference, q: GetTeacherSessionsDto) {
    return this.store.scope(
      actor,
      null,
      async ({ manager, actor: current }) => {
        const values: unknown[] = [
          current.actorId,
          q.archived === 'true',
          q.state ?? null,
          q.q?.trim() ?? '',
        ];
        const where =
          "owner_user_id=$1 AND (state='archived')=$2 AND ($3::text IS NULL OR state=$3) AND ($4='' OR topic ILIKE '%'||$4||'%' OR title ILIKE '%'||$4||'%')";
        const [count]: { total: string }[] = await manager.query(
          `SELECT count(*)::text AS total FROM teacher_sessions WHERE ${where}`,
          values,
        );
        const rows: { id: string; [key: string]: unknown }[] =
          await manager.query(
            `SELECT id,title,topic,objective,explanation_language,requested_organization,requested_day_count,state,revision,current_plan_revision_id,dispatch_limit,dispatches_used,created_at,updated_at FROM teacher_sessions WHERE ${where} ORDER BY updated_at DESC,id DESC LIMIT $5 OFFSET $6`,
            [...values, q.limit, (q.page - 1) * q.limit],
          );
        const total = Number(count.total);
        const jobs = await latestSessionJobs(
          manager,
          rows.map((row) => row.id),
        );
        return {
          data: rows.map((row) => ({
            ...row,
            latest_job: jobs.get(row.id) ?? null,
          })),
          meta: {
            page: q.page,
            limit: q.limit,
            total_items: total,
            total_pages: Math.ceil(total / q.limit),
          },
        };
      },
    );
  }
  detail(actor: ActorReference, id: string) {
    return this.store.scope(actor, id, async ({ manager, session }) => {
      const plans = await manager.query(
        "SELECT id,revision_no,state,outline,content_hash,base_revision_id,base_hash FROM teacher_plan_revisions WHERE session_id=$1 AND (id=$2 OR id=(SELECT id FROM teacher_plan_revisions WHERE session_id=$1 AND state IN ('draft','candidate') ORDER BY revision_no DESC LIMIT 1)) ORDER BY revision_no DESC",
        [id, session!.current_plan_revision_id],
      );
      const proposalSummaries = await manager.query(
        'SELECT id,revision_no,state,content_hash,base_revision_id,base_hash FROM teacher_plan_revisions WHERE session_id=$1 ORDER BY revision_no DESC LIMIT 100',
        [id],
      );
      const [cursor] = await manager.query(
        'SELECT * FROM teacher_cursors WHERE session_id=$1',
        [id],
      );
      const jobs = await manager.query(
        'SELECT id AS job_id,state,purpose FROM teacher_generation_jobs WHERE session_id=$1 ORDER BY created_at DESC LIMIT 20',
        [id],
      );
      const attempts = await manager.query(
        'SELECT id AS attempt_id,scope,section_id,unit_id,state,plan_revision_id,created_at FROM teacher_attempts WHERE session_id=$1 AND is_active ORDER BY created_at DESC,id DESC LIMIT 60',
        [id],
      );
      const verifications = await manager.query(
        'SELECT section_id,plan_revision_id,source_attempt_id,verified_at FROM teacher_section_verifications WHERE session_id=$1 AND plan_revision_id=$2',
        [id, session!.current_plan_revision_id],
      );
      const sections = await manager.query(
        'SELECT s.id AS section_id, EXISTS(SELECT 1 FROM teacher_section_verifications v WHERE v.session_id=s.session_id AND v.plan_revision_id=s.plan_revision_id AND v.section_id=s.id) AS verified, NOT EXISTS(SELECT 1 FROM teacher_section_prerequisites p WHERE p.session_id=s.session_id AND p.plan_revision_id=s.plan_revision_id AND p.section_id=s.id AND NOT EXISTS(SELECT 1 FROM teacher_section_verifications v WHERE v.session_id=p.session_id AND v.plan_revision_id=p.plan_revision_id AND v.section_id=p.required_section_id)) AS prerequisites_ready FROM teacher_sections s WHERE s.session_id=$1 AND s.plan_revision_id=$2 ORDER BY s.ordinal',
        [id, session!.current_plan_revision_id],
      );
      const sectionStates = sections.map(
        (s: {
          section_id: string;
          verified: boolean;
          prerequisites_ready: boolean;
        }) => ({
          section_id: s.section_id,
          verification_state: s.verified ? 'verified' : 'not_verified',
          allowed_actions: {
            ...actions(
              ['start_final', 'retry_final'],
              s.prerequisites_ready &&
                session!.state !== 'paused' &&
                session!.state !== 'archived',
              s.prerequisites_ready
                ? 'session_paused'
                : 'prerequisite_not_verified',
            ),
            ...actions(['review_results'], true),
          },
        }),
      );
      return {
        ...session,
        current_plan:
          plans.find(
            (p: { id: string }) => p.id === session!.current_plan_revision_id,
          ) ?? null,
        latest_proposal:
          plans.find(
            (p: { state: string }) =>
              p.state === 'draft' || p.state === 'candidate',
          ) ?? null,
        proposals: proposalSummaries,
        cursor,
        active_jobs: jobs.filter((j: { state: string }) =>
          ['queued', 'running', 'blocked_paused', 'unknown'].includes(j.state),
        ),
        latest_job_id: jobs[0]?.job_id ?? null,
        active_attempts: attempts,
        section_verifications: verifications,
        section_states: sectionStates,
        allowed_actions: sessionActions(session!),
      };
    });
  }
  proposal(actor: ActorReference, id: string, proposalId: string) {
    requireUuid(proposalId);
    return this.store.scope(actor, id, async ({ manager }) => {
      const [row] = await manager.query(
        'SELECT id,revision_no,state,outline,content_hash,base_revision_id,base_hash FROM teacher_plan_revisions WHERE session_id=$1 AND id=$2',
        [id, proposalId],
      );
      if (!row) teacherError('not_found', 404);
      return row;
    });
  }
  messages(actor: ActorReference, id: string, page = 1, limit = 20) {
    return this.store.scope(actor, id, async ({ manager }) => {
      const [count]: { n: string }[] = await manager.query(
        'SELECT count(*)::text AS n FROM teacher_setup_messages WHERE session_id=$1',
        [id],
      );
      const rows = await manager.query(
        'SELECT id,seq,role,text,generation_job_id,created_at FROM teacher_setup_messages WHERE session_id=$1 ORDER BY seq LIMIT $2 OFFSET $3',
        [id, limit, (page - 1) * limit],
      );
      return {
        data: rows,
        meta: {
          page,
          limit,
          total_items: Number(count.n),
          total_pages: Math.ceil(Number(count.n) / limit),
        },
      };
    });
  }
  material(
    actor: ActorReference,
    id: string,
    unitId: string,
    revision: string,
  ) {
    requireUuid(unitId);
    requireUuid(revision);
    return this.store.scope(actor, id, async ({ manager, session }) => {
      const [unit] = await manager.query(
        'SELECT id FROM teacher_units WHERE session_id=$1 AND plan_revision_id=$2 AND id=$3',
        [id, revision, unitId],
      );
      if (!unit) teacherError('not_found', 404);
      const [content] = await manager.query(
        "SELECT id,public_blocks,version_no,content_hash FROM teacher_content_versions WHERE session_id=$1 AND plan_revision_id=$2 AND unit_id=$3 AND publication_state='current'",
        [id, revision, unitId],
      );
      if (content) {
        const interactions: {
          id: string;
          content_version_id: string;
          block_id: string;
          kind: 'prediction' | 'check';
          text: string;
          created_at: Date | string;
        }[] = await manager.query(
          'SELECT id,content_version_id,block_id,kind,text,created_at FROM teacher_learning_interactions WHERE session_id=$1 AND content_version_id=$2 ORDER BY created_at DESC,id DESC LIMIT 40',
          [id, content.id],
        );
        return {
          kind: 'material',
          resource_id: content.id,
          content_version_id: content.id,
          plan_revision_id: revision,
          unit_id: unitId,
          blocks: content.public_blocks,
          version_no: content.version_no,
          content_hash: content.content_hash,
          lesson_interactions: interactions.map(interaction => ({
            ...interaction,
            created_at: new Date(interaction.created_at).toISOString(),
          })),
          allowed_actions: {
            ...actions(['read_theory'], true),
            ...actions(
              ['start_practice', 'prepare_material'],
              session!.state !== 'paused' && session!.state !== 'archived',
              'session_paused',
            ),
          },
        };
      }
      const [job]: TeacherGenerationJob[] = await manager.query(
        "SELECT * FROM teacher_generation_jobs WHERE session_id=$1 AND plan_revision_id=$2 AND unit_id=$3 AND purpose='learning_packet' ORDER BY created_at DESC LIMIT 1",
        [id, revision, unitId],
      );
      return {
        kind: 'availability',
        state:
          job?.state === 'unknown'
            ? 'unknown'
            : job && ['queued', 'running', 'blocked_paused'].includes(job.state)
              ? 'preparing'
              : 'not_prepared',
        job_id: job?.id ?? null,
      };
    });
  }
  attempt(actor: ActorReference, id: string, attemptId: string) {
    requireUuid(attemptId);
    return this.store.scope(actor, id, async ({ manager, session }) => {
      const [a] = await manager.query(
        'SELECT * FROM teacher_attempts WHERE session_id=$1 AND id=$2',
        [id, attemptId],
      );
      if (!a) teacherError('not_found', 404);
      const rows: {
        question_id: string;
        ordinal: number;
        response_id: string;
        response_revision: number;
        draft_answer: TeacherAnswer | null;
        submitted_at: Date | null;
        objective_ids: string[];
        grade_state: string;
        earned_points: number | null;
        max_points: number;
      }[] = await manager.query(
        'SELECT i.id AS question_id,i.ordinal,i.objective_ids,i.max_points,r.id AS response_id,r.revision AS response_revision,r.draft_answer,r.submitted_at,r.grade_state,r.earned_points FROM teacher_assessment_items i JOIN teacher_responses r ON r.item_id=i.id AND r.attempt_id=$2 WHERE i.session_id=$1 AND i.assessment_id=$3 ORDER BY i.ordinal',
        [id, attemptId, a.assessment_id],
      );
      const questions = rows.map((row) => ({
        question_id: row.question_id,
        ordinal: row.ordinal,
        response_id: row.response_id,
        response_revision: row.response_revision,
        answer_status: teacherAnswerStatus(
          row.draft_answer,
          row.submitted_at !== null,
        ),
      }));
      const editable =
        a.state === 'in_progress' &&
        a.is_active &&
        session!.state !== 'paused' &&
        session!.state !== 'archived';
      const closable =
        a.is_active && a.state === 'grading_pending'
          ? await pendingClosureReason(manager, id, a.id)
          : null;
      const allowed = {
        ...actions(
          ['save_answers', 'submit_attempt', 'request_help'],
          editable,
          'attempt_not_editable',
        ),
        ...actions(
          ['submit_question'],
          editable && a.scope !== 'section_final',
          a.scope === 'section_final'
            ? 'final_requires_full_submit'
            : 'attempt_not_editable',
        ),
        ...actions(
          ['view_feedback'],
          a.scope !== 'section_final' || a.state !== 'in_progress',
          'final_requires_full_submit',
        ),
        ...actions(['new_attempt'], !a.is_active, 'attempt_active'),
        ...actions(
          ['close_pending'],
          closable !== null &&
            session!.state !== 'paused' &&
            session!.state !== 'archived',
          'local_closure_required',
        ),
      };
      if (a.scope === 'section_final')
        allowed.request_help.consequence = {
          assisted: true,
          grants_verification: false,
          notice_key: 'teacher:assisted_final_notice',
        };
      let reinforcement: TeacherReinforcementDto | null = null;
      if (canProjectReinforcement(a)) {
        const [plan]: { outline: PlanOutline }[] = await manager.query(
          'SELECT p.outline FROM teacher_assessments assessment JOIN teacher_plan_revisions p ON p.session_id=assessment.session_id AND p.id=assessment.plan_revision_id WHERE assessment.session_id=$1 AND assessment.id=$2 AND p.id=$3',
          [id, a.assessment_id, a.plan_revision_id],
        );
        reinforcement = projectReinforcement(
          a,
          session!.current_plan_revision_id,
          plan?.outline ?? null,
          rows satisfies ReinforcementGrade[],
        );
      }
      return {
        attempt_id: a.id,
        session_id: id,
        assessment_id: a.assessment_id,
        scope: a.scope,
        plan_revision_id: a.plan_revision_id,
        section_id: a.section_id,
        unit_id: a.unit_id,
        entry_route: a.entry_route,
        state: a.state,
        is_active: a.is_active,
        result: a.result,
        result_applicability:
          a.scope === 'section_final' ? 'applicable' : 'not_applicable',
        revision: a.revision,
        assisted: a.assisted,
        closed_at: a.closed_at,
        closure_reason: a.closure_reason,
        close_pending_reason: closable,
        questions,
        ...(a.state === 'in_progress' && a.scope === 'section_final'
          ? {}
          : {
              earned_points: a.earned_points,
              denominator_points: a.denominator_points,
              percentage:
                a.earned_points === null
                  ? null
                  : (100 * a.earned_points) / a.denominator_points,
            }),
        section_verification_state:
          a.result === 'passed' ? 'verified' : 'not_verified',
        allowed_actions: allowed,
        reinforcement,
      };
    });
  }
  question(
    actor: ActorReference,
    id: string,
    attemptId: string,
    questionId: string,
  ) {
    requireUuid(attemptId);
    requireUuid(questionId);
    return this.store.scope(actor, id, async ({ manager }) => {
      const [a] = await manager.query(
        'SELECT * FROM teacher_attempts WHERE session_id=$1 AND id=$2',
        [id, attemptId],
      );
      if (!a) teacherError('not_found', 404);
      const [r] = await manager.query(
        'SELECT i.id AS question_id,i.ordinal,i.kind,i.public_question,i.max_points,r.id AS response_id,r.revision AS response_revision,r.draft_answer,r.frozen_answer,r.grade_state,r.earned_points,r.feedback,r.submitted_at,r.self_explanation,r.confidence FROM teacher_assessment_items i JOIN teacher_responses r ON r.item_id=i.id AND r.attempt_id=$2 WHERE i.session_id=$1 AND i.assessment_id=$3 AND i.id=$4',
        [id, attemptId, a.assessment_id, questionId],
      );
      if (!r) teacherError('not_found', 404);
      if (a.scope === 'unit_practice' && !r.submitted_at) {
        const [first] = await manager.query(
          'SELECT i.id FROM teacher_assessment_items i JOIN teacher_responses r ON r.item_id=i.id AND r.attempt_id=$1 WHERE i.assessment_id=$2 AND r.submitted_at IS NULL ORDER BY i.ordinal LIMIT 1',
          [attemptId, a.assessment_id],
        );
        if (first?.id !== questionId) teacherError('question_not_current', 409);
      }
      const reveal =
        a.scope !== 'section_final'
          ? !!r.submitted_at
          : a.state !== 'in_progress';
      return {
        question_id: r.question_id,
        ordinal: r.ordinal,
        kind: r.kind,
        ...r.public_question,
        ...(r.public_question.options
          ? {
              options: stableOptions(
                r.public_question.options,
                `${attemptId}:${r.question_id}`,
                r.public_question.prompt,
              ),
            }
          : {}),
        self_explanation: r.self_explanation ?? null,
        confidence: r.confidence ?? null,
        response_id: r.response_id,
        response_revision: r.response_revision,
        draft_answer: r.draft_answer,
        frozen_answer: r.frozen_answer,
        ...(reveal
          ? {
              grade_state: r.grade_state,
              earned_points: r.earned_points,
              max_points: r.max_points,
              feedback: r.feedback
                ? {
                    ...r.feedback,
                    grade_state: r.grade_state,
                    earned_points: r.earned_points,
                    max_points: r.max_points,
                  }
                : null,
            }
          : {}),
      };
    });
  }
  job(actor: ActorReference, jobId: string) {
    requireUuid(jobId);
    return this.store.scope(
      actor,
      null,
      async ({ manager, actor: current }) => {
        const [job]: (TeacherGenerationJob & { session_state: string })[] =
          await manager.query(
            'SELECT j.*,s.state AS session_state FROM teacher_generation_jobs j JOIN teacher_sessions s ON s.id=j.session_id WHERE j.id=$1 AND (s.owner_user_id=$2 OR $3)',
            [jobId, current.actorId, current.isSuperAdmin],
          );
        if (!job) teacherError('not_found', 404);
        const [operation]: {
          remote_outcome: string | null;
          phase: string;
          terminal_proof: unknown;
          acknowledged_at: Date | null;
        }[] = await manager.query(
          'SELECT remote_outcome,phase,terminal_proof,acknowledged_at FROM ai_generation_operations WHERE teacher_job_id=$1 ORDER BY created_at DESC LIMIT 1',
          [jobId],
        );
        const closed = operation
          ? operation.phase === 'closed' && operation.terminal_proof !== null
          : job.dispatches_used === 0 &&
              ['failed_known', 'cancelled_before_dispatch'].includes(job.state)
            ? true
            : null;
        const active = ['queued', 'running'].includes(job.state);
        return {
          job_id: job.id,
          state: job.state,
          purpose: job.purpose,
          target: {
            session_id: job.session_id,
            plan_revision_id: job.plan_revision_id,
            unit_id: job.unit_id,
            section_id: job.section_id,
            attempt_id: job.attempt_id,
          },
          result_ref: job.result_ref,
          error_code: job.error_code,
          local_closed: closed,
          remote_outcome: operation?.remote_outcome ?? null,
          retry_after_ms: active ? 2000 : null,
          fence: job.fence,
          allowed_actions: teacherJobActions(job, job.session_state, {
            localClosed: closed,
            acknowledged: !!operation?.acknowledged_at,
            proof: !!operation?.terminal_proof,
          }),
        };
      },
    );
  }
  receipt(actor: ActorReference, key: string) {
    return this.store.receipt(actor, key);
  }
}
