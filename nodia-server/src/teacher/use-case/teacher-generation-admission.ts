import { randomUUID } from 'node:crypto';
import type { TeacherScope } from '../teacher.service.js';
import type {
  TeacherGenerationPort,
  TeacherPurpose,
} from '../types/teacher.types.js';
import { hash, teacherError } from '../policies/teacher-validation.js';
import { promptSnapshot } from '../policies/teacher-prompts.js';
import { latestTeacherSetupSummary } from './teacher-setup-summary.js';

export async function admitTeacherGeneration(
  scope: TeacherScope,
  port: TeacherGenerationPort,
  purpose: TeacherPurpose,
  input: Record<string, unknown>,
  target: {
    plan_revision_id?: string | null;
    unit_id?: string | null;
    section_id?: string | null;
    attempt_id?: string | null;
  },
  variant = 'current',
  replaces: string | null = null,
) {
  const { manager: m, session: s, actor, reference } = scope;
  if (!s) teacherError('not_found', 404);
  if (s.state === 'paused') teacherError('session_paused');
  if (s.state === 'archived') teacherError('session_archived');
  if (!s.selection) teacherError('no_model');
  const setupSummary = [
    'setup_reply',
    'plan_outline',
    'plan_adjustment',
  ].includes(purpose)
    ? await latestTeacherSetupSummary(m, s.id)
    : null;
  const inputSnapshot = {
    ...input,
    ...(['setup_reply', 'plan_outline', 'plan_adjustment'].includes(purpose)
      ? { setup_summary: setupSummary }
      : {}),
    session: {
      topic: s.topic,
      objective: s.objective,
      context: s.context,
      declared_base: s.declared_base,
      explanation_language: s.explanation_language,
    },
    target,
  };
  const semantic = hash({ purpose, target, input: inputSnapshot, variant });
  const [existing] = await m.query(
    'SELECT id,state FROM teacher_generation_jobs WHERE session_id=$1 AND semantic_key=$2 AND blocks_duplicate',
    [s.id, semantic],
  );
  if (existing)
    return {
      kind: 'job',
      resource_id: existing.id,
      job_id: existing.id,
      state: existing.state,
    };
  if (s.dispatches_used >= s.dispatch_limit)
    teacherError('budget_exhausted', 429);
  const [count]: { n: string }[] = await m.query(
    "SELECT count(*)::text AS n FROM teacher_generation_jobs WHERE actor_id=$1 AND state IN ('queued','running','blocked_paused')",
    [actor.actorId],
  );
  if (Number(count.n) >= 2) teacherError('capacity_unavailable', 429);
  const resolved = await port.verifySelection(m, reference, s.selection);
  const snapshot = promptSnapshot(purpose, inputSnapshot);
  const id = randomUUID();
  await m.query(
    `INSERT INTO teacher_generation_jobs(id,session_id,actor_id,auth_session_public_id,purpose,plan_revision_id,unit_id,section_id,attempt_id,replaces_job_id,semantic_key,input_snapshot,prompt_snapshot,template_ref,template_version,template_hash,input_hash,selection_snapshot,configuration_generation,session_generation,deadline_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,clock_timestamp()+interval '600 seconds')`,
    [
      id,
      s.id,
      actor.actorId,
      actor.sessionId,
      purpose,
      target.plan_revision_id ?? null,
      target.unit_id ?? null,
      target.section_id ?? null,
      target.attempt_id ?? null,
      replaces,
      semantic,
      inputSnapshot,
      snapshot.prompt,
      snapshot.template_ref,
      snapshot.template_version,
      snapshot.template_hash,
      hash(inputSnapshot),
      s.selection,
      resolved.configuration_generation,
      resolved.session_generation,
    ],
  );
  return { kind: 'job', resource_id: id, job_id: id, state: 'queued' };
}
