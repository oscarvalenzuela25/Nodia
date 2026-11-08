import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { TeacherService, type TeacherScope } from '../teacher.service.js';
import {
  TEACHER_GENERATION_PORT,
  type AssessmentPolicy,
  type PrivateKey,
  type TeacherAnswer,
  type TeacherGenerationJob,
  type TeacherGenerationPort,
  type TeacherSessionRow,
} from '../types/teacher.types.js';
import {
  answer,
  blueprint,
  defaultPolicy,
  guide,
  hash,
  language,
  outline,
  requireUuid,
  selection,
  teacherError,
  text,
} from '../policies/teacher-validation.js';
import { deterministicGrade } from '../policies/teacher-assessment.js';
import { admitTeacherGeneration } from './teacher-generation-admission.js';
import {
  outlineIds,
  projectAcceptedPlan,
  saveProposal,
  type PlanRevisionRow,
} from './teacher-plan-persistence.js';
import {
  activeAttempt,
  startStoredAttempt,
  updateAttemptGrade,
} from './teacher-attempt-persistence.js';
import { pendingClosureReason } from './teacher-pending-closure.js';
import { validateCursorPhase } from '../policies/teacher-cursor.js';
import { isCompleteTeacherAnswer } from '../policies/teacher-answer-completeness.js';
import { initialPlanInput } from '../policies/teacher-initial-plan.js';
import { canClearSetupDraft } from '../policies/teacher-setup-draft.js';
import { saveSetupDraft, setupDraftResult } from './teacher-setup-draft.js';

type Body = Record<string, unknown>;
type Target = {
  proposalId?: string;
  unitId?: string;
  sectionId?: string;
  attemptId?: string;
  questionId?: string;
  jobId?: string;
};
function cas(actual: number, expected: unknown) {
  if (actual !== expected || actual >= 2147483647)
    teacherError('revision_conflict');
}
function editable(scope: TeacherScope) {
  if (scope.session!.state === 'paused') teacherError('session_paused');
  if (scope.session!.state === 'archived') teacherError('session_archived');
}
async function bump(scope: TeacherScope) {
  const [row]: { revision: number }[] = await scope.manager.query(
    'WITH updated AS (UPDATE teacher_sessions SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1 RETURNING revision) SELECT revision FROM updated',
    [scope.session!.id],
  );
  scope.session!.revision = row.revision;
  return row.revision;
}
function bodyRecord(dto: object): Body {
  return dto as Body;
}

@Injectable()
export class ExecuteTeacherCommandUseCase {
  constructor(
    private readonly store: TeacherService,
    @Inject(TEACHER_GENERATION_PORT)
    private readonly generation: TeacherGenerationPort,
  ) {}
  execute(
    actor: ActorReference,
    sessionId: string | null,
    key: string,
    operation: string,
    dto: object,
    target: Target = {},
  ) {
    Object.values(target).forEach(requireUuid);
    const body = bodyRecord(dto);
    return this.store.command(
      actor,
      sessionId,
      key,
      operation,
      { target, ...body },
      async (scope) => {
        const sameAccepted =
          operation === 'accept' &&
          scope.session?.current_plan_revision_id === body.proposal_revision_id;
        const receipt = await this.run(scope, operation, body, target);
        return {
          status:
            receipt.kind === 'job'
              ? 202
              : operation === 'create' ||
                  operation === 'message' ||
                  receipt.kind === 'attempt' ||
                  (operation === 'accept' && !sameAccepted)
                ? 201
                : 200,
          receipt,
        };
      },
    );
  }
  async job(
    actor: ActorReference,
    key: string,
    jobId: string,
    op: 'continue_job' | 'new_generation',
    dto: object,
  ) {
    requireUuid(jobId);
    const sessionId = await this.store.scope(
      actor,
      null,
      async ({ manager, actor: current }) => {
        const [j]: { session_id: string }[] = await manager.query(
          'SELECT j.session_id FROM teacher_generation_jobs j JOIN teacher_sessions s ON s.id=j.session_id WHERE j.id=$1 AND (s.owner_user_id=$2 OR $3)',
          [jobId, current.actorId, current.isSuperAdmin],
        );
        if (!j) teacherError('not_found', 404);
        return j.session_id;
      },
    );
    return this.execute(actor, sessionId, key, op, dto, { jobId });
  }
  private async run(
    scope: TeacherScope,
    op: string,
    b: Body,
    t: Target,
  ): Promise<Body> {
    const { manager: m, session: s, actor } = scope;
    if (op === 'create') {
      await m.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `teacher-create:${actor.actorId}`,
      ]);
      const [count]: { n: string }[] = await m.query(
        "SELECT count(*)::text AS n FROM teacher_sessions WHERE owner_user_id=$1 AND state<>'archived'",
        [actor.actorId],
      );
      if (Number(count.n) >= 100) teacherError('session_limit', 409);
      const id = randomUUID(),
        organization = b.organization ?? 'teacher_suggests',
        days = b.day_count ?? null;
      const planInput = initialPlanInput(organization, days);
      if (b.start_plan !== undefined && typeof b.start_plan !== 'boolean')
        teacherError('invalid_input', 400);
      const selected = b.selection == null ? null : selection(b.selection);
      if (b.start_plan === true && !selected) teacherError('no_model');
      const [created]: TeacherSessionRow[] = await m.query(
        'INSERT INTO teacher_sessions(id,owner_user_id,title,topic,objective,declared_base,context,explanation_language,requested_organization,requested_day_count,selection,created_by_actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$2) RETURNING *',
        [
          id,
          actor.actorId,
          b.title ?? null,
          text(b.topic, 1, 240),
          text(b.objective, 1, 2000),
          b.declared_base ?? null,
          b.context ?? null,
          language(b.explanation_language),
          organization,
          days,
          selected,
        ],
      );
      await m.query(
        'INSERT INTO teacher_cursors(session_id,updated_by_actor_id) VALUES($1,$2)',
        [id, actor.actorId],
      );
      if (b.start_plan === true) {
        scope.session = created;
        return {
          ...(await admitTeacherGeneration(scope, this.generation, 'plan_outline', planInput, { plan_revision_id: null })),
          session_id: id,
          revision: created.revision,
        };
      }
      return { session_id: id, revision: 1 };
    }
    if (!s) teacherError('not_found', 404);
    if (op === 'setup_draft') {
      return {
        session_id: s.id,
        ...(await saveSetupDraft(scope, b.expected_draft_revision, b.text)),
      };
    }
    if (op === 'continue_job' || op === 'new_generation') {
      editable(scope);
      cas(s.revision, b.expected_session_revision);
      const [j]: TeacherGenerationJob[] = await m.query(
        'SELECT * FROM teacher_generation_jobs WHERE session_id=$1 AND id=$2 FOR UPDATE',
        [s.id, t.jobId],
      );
      if (!j || j.fence !== b.expected_job_fence)
        teacherError('revision_conflict');
      if (op === 'continue_job') {
        if (
          j.state !== 'blocked_paused' ||
          j.dispatches_used !== 0 ||
          new Date(j.deadline_at).getTime() <= Date.now() ||
          new Date(j.created_at).getTime() + 300000 <= Date.now() ||
          hash(j.selection_snapshot) !== hash(s.selection)
        )
          teacherError('job_not_resumable');
        if (!s.selection) teacherError('no_model');
        const config = await this.generation.verifySelection(
          m,
          scope.reference,
          s.selection,
        );
        const [snapshot]: {
          configuration_generation: string;
          session_generation: string | null;
        }[] = await m.query(
          'SELECT configuration_generation,session_generation FROM teacher_generation_jobs WHERE id=$1',
          [j.id],
        );
        if (
          config.configuration_generation !==
            snapshot.configuration_generation ||
          config.session_generation !== snapshot.session_generation
        )
          teacherError('configuration_changed');
        await m.query(
          "UPDATE teacher_generation_jobs SET state='queued',available_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1",
          [j.id],
        );
        return {
          kind: 'job',
          job_id: j.id,
          resource_id: j.id,
          state: 'queued',
        };
      }
      if (
        !['learning_packet', 'assessment_only'].includes(j.purpose) ||
        !['unknown', 'failed_known'].includes(j.state)
      )
        teacherError('job_not_resumable');
      if (j.state === 'unknown') {
        const [operation]: { phase: string; terminal_proof: unknown }[] =
          await m.query(
            'SELECT phase,terminal_proof FROM ai_generation_operations WHERE teacher_job_id=$1 ORDER BY created_at DESC LIMIT 1',
            [j.id],
          );
        if (
          operation?.phase !== 'closed' ||
          !operation.terminal_proof ||
          j.blocks_duplicate
        )
          teacherError('local_closure_required');
      }
      if (j.plan_revision_id !== s.current_plan_revision_id)
        teacherError('proposal_obsolete');
      const input = { ...j.input_snapshot };
      delete input.session;
      delete input.target;
      return admitTeacherGeneration(
        scope,
        this.generation,
        j.purpose,
        input,
        {
          plan_revision_id: j.plan_revision_id,
          section_id: j.section_id,
          unit_id: j.unit_id,
        },
        randomUUID(),
        j.id,
      );
    }
    if (op === 'patch') {
      editable(scope);
      cas(s.revision, b.expected_session_revision);
      const fields: Record<string, unknown> = {};
      for (const key of [
        'topic',
        'objective',
        'title',
        'declared_base',
        'context',
      ] as const)
        if (b[key] !== undefined) {
          if (b[key] === null) {
            if (!['title', 'declared_base', 'context'].includes(key))
              teacherError('invalid_input', 400);
            fields[key] = null;
          } else
            fields[key] = text(
              b[key],
              key === 'declared_base' || key === 'context' ? 0 : 1,
              key === 'topic'
                ? 240
                : key === 'objective'
                  ? 2000
                  : key === 'title'
                    ? 120
                    : 4000,
            );
        }
      if (b.explanation_language !== undefined)
        fields.explanation_language = language(b.explanation_language);
      if (b.organization !== undefined)
        fields.requested_organization = b.organization;
      if (b.day_count !== undefined) fields.requested_day_count = b.day_count;
      if (b.selection !== undefined)
        fields.selection = b.selection === null ? null : selection(b.selection);
      if (
        (fields.requested_organization ?? s.requested_organization) ===
          'topics' &&
        (fields.requested_day_count === undefined
          ? s.requested_day_count
          : fields.requested_day_count) !== null
      )
        teacherError('invalid_input', 400);
      const keys = Object.keys(fields);
      if (keys.length)
        await m.query(
          `UPDATE teacher_sessions SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(',')} WHERE id=$1`,
          [s.id, ...Object.values(fields)],
        );
      return { session_id: s.id, revision: await bump(scope) };
    }
    if (['pause', 'resume', 'archive', 'unarchive'].includes(op))
      return this.state(scope, op, b);
    if (op === 'cursor') {
      editable(scope);
      return this.cursor(scope, b, b.expected_cursor_revision);
    }
    if (op === 'message') {
      editable(scope);
      cas(s.revision, b.expected_session_revision);
      const message = text(b.text, 1, 4000);
      if (Buffer.byteLength(message) > 8192) teacherError('invalid_input', 400);
      const [last]: { n: string }[] = await m.query(
        'SELECT coalesce(max(seq),0)::text AS n FROM teacher_setup_messages WHERE session_id=$1',
        [s.id],
      );
      if (BigInt(last.n) >= 99n) teacherError('message_limit');
      const id = randomUUID();
      await m.query(
        "INSERT INTO teacher_setup_messages(id,session_id,seq,role,actor_id,text) VALUES($1,$2,$3,'user',$4,$5)",
        [id, s.id, (BigInt(last.n) + 1n).toString(), actor.actorId, message],
      );
      if (canClearSetupDraft(s, b.expected_draft_revision, message))
        await saveSetupDraft(scope, b.expected_draft_revision, '');
      const revision = await bump(scope);
      if (b.generate_reply === false)
        return { session_id: s.id, message_id: id, revision, ...setupDraftResult(scope) };
      const messages = await m.query(
        'SELECT id,seq,role,text FROM teacher_setup_messages WHERE session_id=$1 ORDER BY seq DESC LIMIT 12',
        [s.id],
      );
      return {
        ...(await admitTeacherGeneration(
          scope,
          this.generation,
          'setup_reply',
          { messages: messages.reverse() },
          {},
        )),
        session_id: s.id,
        message_id: id,
        revision,
        ...setupDraftResult(scope),
      };
    }
    if (op === 'propose') {
      editable(scope);
      cas(s.revision, b.expected_session_revision);
      if (
        (b.base_proposal_id === undefined) !== (b.base_hash === undefined) ||
        !!b.adjustment_text !== (b.base_proposal_id !== undefined)
      )
        teacherError('invalid_input', 400);
      const planInput = initialPlanInput(b.organization, b.day_count);
      let base: PlanRevisionRow | null = null;
      if (b.base_proposal_id) {
        base = await this.plan(m, s.id, String(b.base_proposal_id));
        if (base.content_hash !== b.base_hash)
          teacherError('proposal_obsolete');
      }
      const messages = await m.query(
        'SELECT id,seq,role,text FROM teacher_setup_messages WHERE session_id=$1 ORDER BY seq DESC LIMIT 12',
        [s.id],
      );
      return {
        ...(await admitTeacherGeneration(
          scope,
          this.generation,
          base ? 'plan_adjustment' : 'plan_outline',
          {
            ...planInput,
            messages: messages.reverse(),
            base: base
              ? {
                  id: base.id,
                  content_hash: base.content_hash,
                  outline: base.outline,
                  guide: base.private_guide,
                }
              : null,
            adjustment_text: b.adjustment_text ?? null,
          },
          { plan_revision_id: base?.id ?? null },
        )),
        session_id: s.id,
        revision: s.revision,
      };
    }
    if (op === 'patch_proposal') {
      editable(scope);
      cas(s.revision, b.expected_session_revision);
      const base = await this.plan(m, s.id, t.proposalId!);
      if (
        base.content_hash !== b.expected_proposal_hash ||
        !(
          ['draft', 'candidate'].includes(base.state) ||
          (base.state === 'accepted' && base.id === s.current_plan_revision_id)
        )
      )
        teacherError('proposal_obsolete');
      const plan = outline(b.outline, outlineIds(base.outline), false);
      const saved = await saveProposal(
        m,
        s,
        actor.actorId,
        plan,
        b.guide === undefined ? base.private_guide : guide(b.guide),
        base,
      );
      return { ...saved, session_id: s.id, revision: await bump(scope) };
    }
    if (op === 'apply_candidate') {
      editable(scope);
      cas(s.revision, b.expected_session_revision);
      if (t.proposalId !== b.expected_base_revision_id)
        teacherError('proposal_obsolete');
      const base = await this.plan(m, s.id, t.proposalId!),
        candidate = await this.plan(m, s.id, String(b.candidate_id));
      const [latest]: { id: string }[] = await m.query(
        "SELECT id FROM teacher_plan_revisions WHERE session_id=$1 AND state='draft' ORDER BY revision_no DESC LIMIT 1",
        [s.id],
      );
      if (
        base.content_hash !== b.expected_base_hash ||
        candidate.state !== 'candidate' ||
        candidate.base_revision_id !== base.id ||
        candidate.base_hash !== base.content_hash ||
        (latest && latest.id !== base.id)
      )
        teacherError('proposal_obsolete');
      const saved = await saveProposal(
        m,
        s,
        actor.actorId,
        candidate.outline,
        candidate.private_guide,
        base,
      );
      return { ...saved, session_id: s.id, revision: await bump(scope) };
    }
    if (op === 'accept' || op === 'activate') {
      editable(scope);
      const p = await this.plan(m, s.id, t.proposalId!);
      if (p.id !== b.proposal_revision_id || p.content_hash !== b.proposal_hash)
        teacherError('proposal_obsolete');
      if (s.current_plan_revision_id === p.id && p.state === 'accepted')
        return {
          session_id: s.id,
          plan_revision_id: p.id,
          revision: s.revision,
        };
      cas(s.revision, b.expected_session_revision);
      if (
        (op === 'accept' && s.current_plan_revision_id) ||
        (op === 'activate' &&
          s.current_plan_revision_id !== b.expected_current_plan_revision_id)
      )
        teacherError('revision_conflict');
      if (!['draft', 'candidate'].includes(p.state))
        teacherError('proposal_obsolete');
      outline(p.outline, outlineIds(p.outline));
      await projectAcceptedPlan(m, s, p);
      await m.query(
        "UPDATE teacher_plan_revisions SET state='superseded' WHERE session_id=$1 AND state='accepted'",
        [s.id],
      );
      await m.query(
        "UPDATE teacher_plan_revisions SET state='accepted' WHERE id=$1",
        [p.id],
      );
      const [complete]: { done: boolean }[] = await m.query(
        'SELECT EXISTS(SELECT 1 FROM teacher_sections WHERE session_id=$1 AND plan_revision_id=$2 AND required) AND NOT EXISTS(SELECT 1 FROM teacher_sections s WHERE s.session_id=$1 AND s.plan_revision_id=$2 AND s.required AND NOT EXISTS(SELECT 1 FROM teacher_section_verifications v WHERE v.session_id=s.session_id AND v.plan_revision_id=s.plan_revision_id AND v.section_id=s.id)) AS done',
        [s.id, p.id],
      );
      await m.query(
        'UPDATE teacher_sessions SET current_plan_revision_id=$2,title=$3,topic=$4,objective=$5,explanation_language=$6,requested_organization=$7,requested_day_count=$8,state=$9 WHERE id=$1',
        [
          s.id,
          p.id,
          p.outline.title,
          p.outline.topic,
          p.outline.objective,
          p.outline.explanation_language,
          p.outline.organization,
          p.outline.day_count,
          complete.done ? 'completed' : 'active',
        ],
      );
      await m.query(
        "UPDATE teacher_cursors SET plan_revision_id=$2,section_id=NULL,unit_id=NULL,content_version_id=NULL,attempt_id=NULL,item_id=NULL,assessment_id=NULL,block_id=NULL,phase='setup',revision=revision+1,updated_by_actor_id=$3,updated_at=clock_timestamp() WHERE session_id=$1",
        [s.id, p.id, actor.actorId],
      );
      return {
        session_id: s.id,
        plan_revision_id: p.id,
        revision: await bump(scope),
      };
    }
    if (
      op === 'material' ||
      op === 'start_practice' ||
      op === 'start_final' ||
      op === 'start_diagnostic'
    )
      return this.prepare(scope, op, b, t);
    if (
      [
        'patch_responses',
        'submit_question',
        'submit_attempt',
        'help',
        'close_pending',
      ].includes(op)
    )
      return this.attempt(scope, op, b, t);
    teacherError('invalid_input', 400);
  }
  private async plan(
    m: EntityManager,
    sessionId: string,
    id: string,
  ): Promise<PlanRevisionRow> {
    requireUuid(id);
    const [p]: PlanRevisionRow[] = await m.query(
      'SELECT * FROM teacher_plan_revisions WHERE session_id=$1 AND id=$2',
      [sessionId, id],
    );
    if (!p) teacherError('not_found', 404);
    return p;
  }
  private async state(scope: TeacherScope, op: string, b: Body): Promise<Body> {
    const { manager: m, session: s } = scope;
    cas(s!.revision, b.expected_session_revision);
    if (op === 'pause') {
      editable(scope);
      if (b.pending_setup_draft !== undefined) {
        const pending = b.pending_setup_draft as Body;
        if (!pending || typeof pending !== 'object' || Array.isArray(pending))
          teacherError('invalid_input', 400);
        await saveSetupDraft(scope, pending.expected_draft_revision, pending.text);
      }
      if (b.pending_responses) {
        if (typeof b.attempt_id !== 'string')
          teacherError('invalid_input', 400);
        await this.attempt(
          scope,
          'patch_responses',
          {
            expected_attempt_revision: b.expected_attempt_revision,
            responses: b.pending_responses,
          },
          { attemptId: b.attempt_id },
        );
      }
      const cursor = await this.cursor(
        scope,
        b.cursor as Body,
        b.expected_cursor_revision,
      );
      await m.query(
        "UPDATE teacher_sessions SET resume_state=state,state='paused' WHERE id=$1",
        [s!.id],
      );
      await m.query(
        "UPDATE teacher_generation_jobs SET state='blocked_paused',updated_at=clock_timestamp() WHERE session_id=$1 AND state='queued' AND dispatches_used=0",
        [s!.id],
      );
      return {
        session_id: s!.id,
        state: 'paused',
        revision: await bump(scope),
        cursor_revision: cursor.revision,
        ...setupDraftResult(scope),
      };
    }
    if (op === 'resume') {
      if (s!.state !== 'paused') teacherError('session_not_paused');
      await m.query(
        'UPDATE teacher_sessions SET state=resume_state,resume_state=NULL WHERE id=$1',
        [s!.id],
      );
    }
    if (op === 'archive') {
      if (s!.state === 'archived') teacherError('session_archived');
      await m.query(
        "UPDATE teacher_sessions SET archived_state=state,state='archived' WHERE id=$1",
        [s!.id],
      );
      await m.query(
        "UPDATE teacher_generation_jobs SET state='blocked_paused',updated_at=clock_timestamp() WHERE session_id=$1 AND state='queued' AND dispatches_used=0",
        [s!.id],
      );
    }
    if (op === 'unarchive') {
      if (s!.state !== 'archived') teacherError('session_not_archived');
      const [count]: { n: string }[] = await m.query(
        "SELECT count(*)::text AS n FROM teacher_sessions WHERE owner_user_id=$1 AND state<>'archived'",
        [s!.owner_user_id],
      );
      if (Number(count.n) >= 100) teacherError('session_limit');
      await m.query(
        'UPDATE teacher_sessions SET state=archived_state,archived_state=NULL WHERE id=$1',
        [s!.id],
      );
    }
    const revision = await bump(scope);
    const [current]: { state: string }[] = await m.query(
      'SELECT state FROM teacher_sessions WHERE id=$1',
      [s!.id],
    );
    return { session_id: s!.id, state: current.state, revision };
  }
  private async cursor(
    scope: TeacherScope,
    b: Body,
    expected: unknown,
  ): Promise<Body> {
    const { manager: m, session: s, actor } = scope;
    const [c]: { revision: number }[] = await m.query(
      'SELECT revision FROM teacher_cursors WHERE session_id=$1 FOR UPDATE',
      [s!.id],
    );
    cas(c.revision, expected);
    const revision = b.plan_revision_id ?? null,
      section = b.section_id ?? null,
      unit = b.unit_id ?? null,
      content = b.content_version_id ?? null,
      attempt = b.attempt_id ?? null,
      item = b.item_id ?? null,
      block = b.block_id ?? null;
    if (revision) {
      const [p] = await m.query(
        'SELECT id FROM teacher_plan_revisions WHERE session_id=$1 AND id=$2',
        [s!.id, revision],
      );
      if (!p) teacherError('invalid_input', 400);
    }
    if (section) {
      const [row] = await m.query(
        'SELECT id FROM teacher_sections WHERE session_id=$1 AND plan_revision_id=$2 AND id=$3',
        [s!.id, revision, section],
      );
      if (!row) teacherError('invalid_input', 400);
    }
    if (unit) {
      const [row] = await m.query(
        'SELECT id FROM teacher_units WHERE session_id=$1 AND plan_revision_id=$2 AND section_id=$3 AND id=$4',
        [s!.id, revision, section, unit],
      );
      if (!row) teacherError('invalid_input', 400);
    }
    if (content) {
      const [row] = await m.query(
        'SELECT public_blocks FROM teacher_content_versions WHERE session_id=$1 AND plan_revision_id=$2 AND unit_id=$3 AND id=$4',
        [s!.id, revision, unit, content],
      );
      if (
        !row ||
        (block &&
          !row.public_blocks.some((v: { id: string }) => v.id === block))
      )
        teacherError('invalid_input', 400);
    }
    if (block && !content) teacherError('invalid_input', 400);
    let assessmentId: string | null = null,
      attemptScope: string | null = null;
    if (attempt) {
      const [a] = await m.query(
        'SELECT id,assessment_id,plan_revision_id,section_id,unit_id,scope FROM teacher_attempts WHERE session_id=$1 AND id=$2',
        [s!.id, attempt],
      );
      if (
        !a ||
        a.plan_revision_id !== revision ||
        a.section_id !== section ||
        a.unit_id !== unit
      )
        teacherError('invalid_input', 400);
      assessmentId = a.assessment_id;
      attemptScope = a.scope;
      if (item) {
        const [q] = await m.query(
          'SELECT id FROM teacher_assessment_items WHERE session_id=$1 AND assessment_id=$2 AND id=$3',
          [s!.id, a.assessment_id, item],
        );
        if (!q) teacherError('invalid_input', 400);
      }
    }
    validateCursorPhase(b.phase, {
      unit,
      content,
      attempt,
      item,
      block,
      attemptScope,
    });
    await m.query(
      'UPDATE teacher_cursors SET plan_revision_id=$2,section_id=$3,unit_id=$4,content_version_id=$5,attempt_id=$6,item_id=$7,phase=$8,block_id=$9,revision=revision+1,updated_by_actor_id=$10,assessment_id=$11,updated_at=clock_timestamp() WHERE session_id=$1',
      [
        s!.id,
        revision,
        section,
        unit,
        content,
        attempt,
        item,
        b.phase,
        block,
        actor.actorId,
        assessmentId,
      ],
    );
    if (content && block)
      await m.query(
        `INSERT INTO teacher_unit_progress(session_id,plan_revision_id,unit_id,content_version_id,state,visited_block_ids) VALUES($1,$2,$3,$4,'in_progress',$5) ON CONFLICT(plan_revision_id,unit_id,content_version_id) DO UPDATE SET visited_block_ids=CASE WHEN NOT teacher_unit_progress.visited_block_ids @> EXCLUDED.visited_block_ids THEN teacher_unit_progress.visited_block_ids || EXCLUDED.visited_block_ids ELSE teacher_unit_progress.visited_block_ids END,revision=teacher_unit_progress.revision+1,updated_at=clock_timestamp()`,
        [s!.id, revision, unit, content, JSON.stringify([block])],
      );
    return {
      session_id: s!.id,
      revision: c.revision + 1,
      cursor_revision: c.revision + 1,
    };
  }
  private async prepare(
    scope: TeacherScope,
    op: string,
    b: Body,
    t: Target,
  ): Promise<Body> {
    editable(scope);
    const { manager: m, session: s } = scope;
    cas(s!.revision, b.expected_session_revision);
    const diagnostic = op === 'start_diagnostic',
      revision = diagnostic ? null : requireUuid(b.plan_revision_id),
      unit = t.unitId ?? null;
    let section = t.sectionId ?? null;
    if (!diagnostic && revision !== s!.current_plan_revision_id)
      teacherError('proposal_obsolete');
    let policy: AssessmentPolicy = defaultPolicy(),
      objectives: string[] = [];
    let plan: PlanRevisionRow | null = null;
    if (!diagnostic) {
      plan = await this.plan(m, s!.id, revision!);
      policy = plan.assessment_policy;
      if (unit) {
        const [u]: { section_id: string }[] = await m.query(
          'SELECT section_id FROM teacher_units WHERE session_id=$1 AND plan_revision_id=$2 AND id=$3',
          [s!.id, revision, unit],
        );
        if (!u) teacherError('not_found', 404);
        section = u.section_id;
      }
      const sectionOutline = plan.outline.sections.find(
        (x) => x.id === section,
      );
      if (!sectionOutline) teacherError('not_found', 404);
      objectives = unit
        ? sectionOutline.units.find((u) => u.id === unit)!.objective_ids
        : sectionOutline.objectives.map((o) => o.id);
      if (op === 'start_final') {
        const [blocked]: { n: string }[] = await m.query(
          'SELECT count(*)::text AS n FROM teacher_section_prerequisites p WHERE p.session_id=$1 AND p.plan_revision_id=$2 AND p.section_id=$3 AND NOT EXISTS(SELECT 1 FROM teacher_section_verifications v WHERE v.session_id=p.session_id AND v.plan_revision_id=p.plan_revision_id AND v.section_id=p.required_section_id)',
          [s!.id, revision, section],
        );
        if (Number(blocked.n)) teacherError('prerequisite_not_verified');
      }
    } else
      objectives = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    if (op === 'material' && b.variant === 'current') {
      const [content] = await m.query(
        "SELECT id FROM teacher_content_versions WHERE session_id=$1 AND plan_revision_id=$2 AND unit_id=$3 AND publication_state='current'",
        [s!.id, revision, unit],
      );
      if (content)
        return {
          kind: 'material',
          resource_id: content.id,
          content_version_id: content.id,
        };
    }
    const assessmentScope = diagnostic
      ? 'diagnostic'
      : op === 'start_final'
        ? 'section_final'
        : 'unit_practice';
    if (op !== 'material') {
      const allowedRoute =
        assessmentScope === 'diagnostic'
          ? b.entry_route === 'diagnostic'
          : assessmentScope === 'unit_practice'
            ? b.entry_route === 'practice'
            : ['direct', 'after_study'].includes(String(b.entry_route));
      if (!allowedRoute) teacherError('invalid_input', 400);
      const active = await activeAttempt(
        m,
        s!.id,
        assessmentScope,
        revision,
        section,
        unit,
      );
      if (active)
        return {
          kind: 'attempt',
          resource_id: active.id,
          attempt_id: active.id,
          revision: active.revision,
        };
      const assessments = await m.query(
        "SELECT a.id FROM teacher_assessments a WHERE a.session_id=$1 AND a.scope=$2 AND a.plan_revision_id IS NOT DISTINCT FROM $3::uuid AND a.section_id IS NOT DISTINCT FROM $4::uuid AND a.unit_id IS NOT DISTINCT FROM $5::uuid AND a.status='ready' AND NOT EXISTS(SELECT 1 FROM teacher_attempts t WHERE t.assessment_id=a.id) ORDER BY a.version_no DESC LIMIT 1",
        [s!.id, assessmentScope, revision, section, unit],
      );
      if (assessments[0])
        return startStoredAttempt(
          m,
          s!,
          assessments[0].id,
          String(b.entry_route),
        );
    }
    const purpose =
      assessmentScope === 'unit_practice'
        ? 'learning_packet'
        : 'assessment_only';
    const [pending]: { id: string; state: string }[] = await m.query(
      'SELECT id,state FROM teacher_generation_jobs WHERE session_id=$1 AND purpose=$2 AND plan_revision_id IS NOT DISTINCT FROM $3::uuid AND section_id IS NOT DISTINCT FROM $4::uuid AND unit_id IS NOT DISTINCT FROM $5::uuid AND blocks_duplicate ORDER BY created_at LIMIT 1',
      [s!.id, purpose, revision, section, unit],
    );
    if (pending)
      return {
        kind: 'job',
        resource_id: pending.id,
        job_id: pending.id,
        state: pending.state,
      };
    const counts =
      assessmentScope === 'unit_practice'
        ? policy.practice_counts
        : assessmentScope === 'section_final'
          ? policy.final_counts
          : policy.diagnostic_counts;
    const slots = blueprint(objectives, counts);
    const seen =
      assessmentScope === 'section_final'
        ? await m.query(
            'SELECT i.item_fingerprint,i.public_question FROM teacher_assessment_items i JOIN teacher_assessments a ON a.id=i.assessment_id JOIN teacher_attempts t ON t.assessment_id=a.id WHERE a.session_id=$1 AND a.section_id=$2 ORDER BY a.created_at DESC LIMIT 128',
            [s!.id, section],
          )
        : [];
    return {
      ...(await admitTeacherGeneration(
        scope,
        this.generation,
        assessmentScope === 'unit_practice'
          ? 'learning_packet'
          : 'assessment_only',
        {
          scope: assessmentScope,
          blueprint: slots,
          policy,
          outline: plan?.outline ?? null,
          guide: plan?.private_guide ?? null,
          seen_items: seen,
          start_attempt: op !== 'material',
          entry_route: b.entry_route ?? null,
        },
        { plan_revision_id: revision, unit_id: unit, section_id: section },
        b.variant === 'new' || b.new_attempt === true
          ? randomUUID()
          : 'current',
      )),
      session_id: s!.id,
    };
  }
  private async attempt(
    scope: TeacherScope,
    op: string,
    b: Body,
    t: Target,
  ): Promise<Body> {
    editable(scope);
    const { manager: m, session: s } = scope;
    const [a] = await m.query(
      'SELECT * FROM teacher_attempts WHERE session_id=$1 AND id=$2 FOR UPDATE',
      [s!.id, t.attemptId],
    );
    if (!a) teacherError('not_found', 404);
    cas(a.revision, b.expected_attempt_revision);
    if (op === 'close_pending') {
      if (!a.is_active || a.state !== 'grading_pending')
        teacherError('grading_not_pending');
      const reason = await pendingClosureReason(m, s!.id, a.id);
      if (reason === null || reason !== b.reason)
        teacherError('local_closure_required');
      await m.query(
        "UPDATE teacher_attempts SET is_active=false,closed_at=clock_timestamp(),closure_reason=$2,earned_points=NULL,result=CASE WHEN scope='section_final' THEN 'pending' ELSE NULL END,revision=revision+1 WHERE id=$1",
        [a.id, b.reason],
      );
      return {
        attempt_id: a.id,
        revision: a.revision + 1,
        state: 'grading_pending',
        result: a.scope === 'section_final' ? 'pending' : null,
        is_active: false,
      };
    }
    if (a.state !== 'in_progress' || !a.is_active)
      teacherError('response_already_submitted');
    if (op === 'help') {
      if (b.accept_assisted_attempt !== true)
        teacherError('invalid_input', 400);
      if (a.scope === 'unit_practice')
        await this.currentPracticeQuestion(
          m,
          a.id,
          a.assessment_id,
          String(b.question_id),
        );
      const [row] = await m.query(
        'SELECT k.hint,i.public_question,k.private_key FROM teacher_assessment_keys k JOIN teacher_assessment_items i ON i.id=k.item_id WHERE k.session_id=$1 AND k.assessment_id=$2 AND k.item_id=$3',
        [s!.id, a.assessment_id, b.question_id],
      );
      if (!row?.hint) teacherError('help_unavailable');
      if (row.private_key.kind === 'single_choice') {
        const correct = row.public_question.options.find(
          (o: { id: string }) => o.id === row.private_key.option_id,
        );
        if (
          correct &&
          row.hint
            .toLocaleLowerCase('und')
            .includes(correct.label.toLocaleLowerCase('und'))
        )
          teacherError('help_unavailable');
      }
      await m.query(
        'UPDATE teacher_attempts SET assisted=true,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',
        [a.id],
      );
      await m.query(
        'UPDATE teacher_responses SET assistance=assistance||\'{"hint_requested":true}\'::jsonb WHERE attempt_id=$1 AND item_id=$2',
        [a.id, b.question_id],
      );
      return {
        attempt_id: a.id,
        revision: a.revision + 1,
        hint: row.hint,
        assisted: true,
      };
    }
    if (op === 'patch_responses') {
      const patches = b.responses as {
        question_id: string;
        expected_response_revision: number;
        answer: unknown;
      }[];
      if (
        !patches ||
        patches.length < 1 ||
        patches.length > 24 ||
        new Set(patches.map((p) => p.question_id)).size !== patches.length
      )
        teacherError('invalid_input', 400);
      const revisions = [];
      for (const patch of patches) {
        const [r] = await m.query(
          'SELECT r.*,i.kind,i.public_question FROM teacher_responses r JOIN teacher_assessment_items i ON i.id=r.item_id WHERE r.session_id=$1 AND r.attempt_id=$2 AND r.item_id=$3 FOR UPDATE OF r',
          [s!.id, a.id, patch.question_id],
        );
        if (!r) teacherError('not_found', 404);
        cas(r.revision, patch.expected_response_revision);
        if (r.submitted_at) teacherError('response_already_submitted');
        if (a.scope === 'unit_practice')
          await this.currentPracticeQuestion(
            m,
            a.id,
            a.assessment_id,
            patch.question_id,
          );
        const value = answer(patch.answer);
        this.validAnswer(value, r.kind, r.public_question, true);
        await m.query(
          'UPDATE teacher_responses SET draft_answer=$2,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',
          [r.id, value],
        );
        revisions.push({
          question_id: r.item_id,
          response_revision: r.revision + 1,
        });
      }
      await m.query(
        'UPDATE teacher_attempts SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',
        [a.id],
      );
      return {
        attempt_id: a.id,
        revision: a.revision + 1,
        responses: revisions,
      };
    }
    if (op === 'submit_question' && a.scope === 'section_final')
      teacherError('final_requires_full_submit');
    if (op === 'submit_question') {
      const [r] = await m.query(
        'SELECT r.*,i.kind,i.public_question FROM teacher_responses r JOIN teacher_assessment_items i ON i.id=r.item_id WHERE r.session_id=$1 AND r.attempt_id=$2 AND r.item_id=$3 FOR UPDATE OF r',
        [s!.id, a.id, t.questionId],
      );
      if (!r) teacherError('not_found', 404);
      cas(r.revision, b.expected_response_revision);
      if (r.submitted_at) teacherError('response_already_submitted');
      const [first] = await m.query(
        'SELECT i.id FROM teacher_assessment_items i JOIN teacher_responses r ON r.item_id=i.id AND r.attempt_id=$1 WHERE i.assessment_id=$2 AND r.submitted_at IS NULL ORDER BY i.ordinal LIMIT 1',
        [a.id, a.assessment_id],
      );
      if (first?.id !== r.item_id) teacherError('question_not_current');
      const value = answer(b.answer);
      this.validAnswer(value, r.kind, r.public_question);
      await m.query(
        'UPDATE teacher_responses SET draft_answer=$2 WHERE id=$1',
        [r.id, value],
      );
      await this.gradeRows(scope, a.id, [r.item_id]);
      const [pending]: { n: string }[] = await m.query(
        "SELECT count(*)::text AS n FROM teacher_responses WHERE attempt_id=$1 AND item_id=$2 AND grade_state='pending'",
        [a.id, r.item_id],
      );
      let job: Body = {};
      if (Number(pending.n)) job = await this.feedbackJob(scope, a.id);
      await m.query(
        'UPDATE teacher_attempts SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',
        [a.id],
      );
      return {
        attempt_id: a.id,
        question_id: r.item_id,
        revision: a.revision + 1,
        ...job,
      };
    }
    if (op === 'submit_attempt') {
      if (a.scope === 'unit_practice') {
        const [unsubmitted]: { n: string }[] = await m.query(
          'SELECT count(*)::text AS n FROM teacher_responses WHERE attempt_id=$1 AND submitted_at IS NULL',
          [a.id],
        );
        if (Number(unsubmitted.n)) teacherError('incomplete_assessment', 400);
      }
      const answers: {
        draft_answer: TeacherAnswer | null;
        frozen_answer: TeacherAnswer | null;
      }[] = await m.query(
        'SELECT draft_answer,frozen_answer FROM teacher_responses WHERE attempt_id=$1',
        [a.id],
      );
      if (
        answers.some(
          (row) =>
            !isCompleteTeacherAnswer(row.frozen_answer ?? row.draft_answer),
        )
      )
        teacherError('incomplete_assessment', 400);
      await this.gradeRows(scope, a.id, null);
      await m.query(
        "UPDATE teacher_attempts SET state='submitted',submitted_at=clock_timestamp(),revision=revision+1 WHERE id=$1",
        [a.id],
      );
      const result = await updateAttemptGrade(m, s!, a.id);
      const [pending]: { n: string }[] = await m.query(
        "SELECT count(*)::text AS n FROM teacher_responses WHERE attempt_id=$1 AND grade_state='pending'",
        [a.id],
      );
      const job = Number(pending.n) ? await this.feedbackJob(scope, a.id) : {};
      return {
        ...job,
        job_state: job.state ?? null,
        attempt_id: a.id,
        ...result,
      };
    }
    teacherError('invalid_input', 400);
  }
  private validAnswer(
    value: TeacherAnswer,
    kind: string,
    question: { options?: { id: string }[] },
    allowEmpty = false,
  ) {
    if (value.kind === 'dont_know') return;
    if (
      value.kind !== kind ||
      (value.kind === 'single_choice' &&
        !question.options?.some((o) => o.id === value.option_id))
    )
      teacherError('invalid_input', 400);
    if (!allowEmpty && !isCompleteTeacherAnswer(value))
      teacherError('incomplete_assessment', 400);
  }
  private async currentPracticeQuestion(
    m: EntityManager,
    attemptId: string,
    assessmentId: string,
    itemId: string,
  ) {
    const [first]: { id: string }[] = await m.query(
      'SELECT i.id FROM teacher_assessment_items i JOIN teacher_responses r ON r.item_id=i.id AND r.attempt_id=$1 WHERE i.assessment_id=$2 AND r.submitted_at IS NULL ORDER BY i.ordinal LIMIT 1',
      [attemptId, assessmentId],
    );
    if (first?.id !== itemId) teacherError('question_not_current');
  }
  private async gradeRows(
    scope: TeacherScope,
    attemptId: string,
    itemIds: string[] | null,
  ) {
    const { manager: m, session: s } = scope;
    const rows = await m.query(
      'SELECT r.*,i.kind,i.public_question,k.private_key,k.expected_explanation FROM teacher_responses r JOIN teacher_assessment_items i ON i.id=r.item_id JOIN teacher_assessment_keys k ON k.item_id=r.item_id WHERE r.session_id=$1 AND r.attempt_id=$2 AND r.submitted_at IS NULL AND ($3::uuid[] IS NULL OR r.item_id=ANY($3)) FOR UPDATE OF r',
      [s!.id, attemptId, itemIds],
    );
    for (const row of rows) {
      const value = answer(row.draft_answer);
      this.validAnswer(value, row.kind, row.public_question);
      const key = row.private_key as PrivateKey;
      const grade = deterministicGrade(value, key);
      const feedback =
        grade.state === 'graded'
          ? {
              correct_answer: key.kind === 'short_text' ? null : key,
              explanation: row.expected_explanation,
            }
          : null;
      await m.query(
        'UPDATE teacher_responses SET frozen_answer=draft_answer,submitted_at=clock_timestamp(),grade_state=$2,earned_points=$3,feedback=$4,explanation_state=$5,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1',
        [
          row.id,
          grade.state,
          grade.points,
          feedback,
          feedback ? 'ready' : 'pending',
        ],
      );
    }
  }
  private async feedbackJob(
    scope: TeacherScope,
    attemptId: string,
  ): Promise<Body> {
    const m = scope.manager;
    const rows = await m.query(
      "SELECT r.id AS response_id,r.frozen_answer,k.private_key,i.public_question,i.objective_ids FROM teacher_responses r JOIN teacher_assessment_keys k ON k.item_id=r.item_id JOIN teacher_assessment_items i ON i.id=r.item_id WHERE r.attempt_id=$1 AND r.grade_state='pending' AND NOT EXISTS(SELECT 1 FROM teacher_generation_jobs j CROSS JOIN LATERAL jsonb_array_elements(coalesce(j.input_snapshot->'responses','[]')) e WHERE j.attempt_id=r.attempt_id AND j.purpose='written_feedback' AND e->>'response_id'=r.id::text) ORDER BY r.id",
      [attemptId],
    );
    if (rows.length > 8) teacherError('invalid_generated_content', 422);
    if (!rows.length) return {};
    const [a] = await m.query(
      'SELECT plan_revision_id,section_id,unit_id FROM teacher_attempts WHERE id=$1',
      [attemptId],
    );
    return admitTeacherGeneration(
      scope,
      this.generation,
      'written_feedback',
      { responses: rows },
      {
        plan_revision_id: a.plan_revision_id,
        section_id: a.section_id,
        unit_id: a.unit_id,
        attempt_id: attemptId,
      },
    );
  }
}
