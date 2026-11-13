import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type {
  AssessmentCandidate,
  AssessmentPolicy,
  BlueprintSlot,
  TeacherSessionRow,
} from '../types/teacher.types.js';
import { hash, teacherError } from '../policies/teacher-validation.js';
import { aggregateGrade } from '../policies/teacher-assessment.js';

export async function activeAttempt(
  m: EntityManager,
  sessionId: string,
  scope: string,
  revision: string | null,
  section: string | null,
  unit: string | null,
) {
  const [row] = await m.query(
    'SELECT * FROM teacher_attempts WHERE session_id=$1 AND scope=$2 AND plan_revision_id IS NOT DISTINCT FROM $3::uuid AND section_id IS NOT DISTINCT FROM $4::uuid AND unit_id IS NOT DISTINCT FROM $5::uuid AND is_active FOR UPDATE',
    [sessionId, scope, revision, section, unit],
  );
  return row;
}
export async function startStoredAttempt(
  m: EntityManager,
  s: TeacherSessionRow,
  assessmentId: string,
  entryRoute: string,
) {
  const [assessment] = await m.query(
    "SELECT * FROM teacher_assessments WHERE session_id=$1 AND id=$2 AND status='ready'",
    [s.id, assessmentId],
  );
  if (!assessment) teacherError('assessment_unavailable');
  const active = await activeAttempt(
    m,
    s.id,
    assessment.scope,
    assessment.plan_revision_id,
    assessment.section_id,
    assessment.unit_id,
  );
  if (active)
    return {
      kind: 'attempt',
      resource_id: active.id,
      attempt_id: active.id,
      revision: active.revision,
    };
  const items = await m.query(
    'SELECT id,max_points FROM teacher_assessment_items WHERE session_id=$1 AND assessment_id=$2 ORDER BY ordinal',
    [s.id, assessmentId],
  );
  if (!items.length) teacherError('assessment_unavailable');
  // Repeating an exposed task is useful retrieval practice, but is not a new
  // independent application even if a later packet gives it another item ID.
  const seen: { id: string; previous_response_id: string }[] = assessment.scope === 'unit_practice'
    ? await m.query(
      `SELECT DISTINCT ON(current.id) current.id,r.id AS previous_response_id
       FROM teacher_assessment_items current JOIN teacher_assessment_items previous
         ON previous.session_id=current.session_id AND (previous.item_fingerprint=current.item_fingerprint OR previous.variant_group=current.variant_group)
       JOIN teacher_responses r ON r.session_id=previous.session_id AND r.item_id=previous.id AND r.submitted_at IS NOT NULL
       WHERE current.session_id=$1 AND current.assessment_id=$2
       ORDER BY current.id,r.submitted_at DESC,r.id DESC`, [s.id, assessmentId])
    : [];
  const seenByItem = new Map(seen.map(item => [item.id, item.previous_response_id]));
  const [last]: { n: number }[] = await m.query(
    'SELECT coalesce(max(attempt_no),0)::integer AS n FROM teacher_attempts WHERE session_id=$1 AND scope=$2 AND plan_revision_id IS NOT DISTINCT FROM $3::uuid AND section_id IS NOT DISTINCT FROM $4::uuid AND unit_id IS NOT DISTINCT FROM $5::uuid',
    [
      s.id,
      assessment.scope,
      assessment.plan_revision_id,
      assessment.section_id,
      assessment.unit_id,
    ],
  );
  const id = randomUUID();
  await m.query(
    `INSERT INTO teacher_attempts(id,session_id,assessment_id,scope,plan_revision_id,section_id,unit_id,attempt_no,entry_route,result,denominator_points,threshold_percent,policy_snapshot,policy_hash,assisted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id,
      s.id,
      assessmentId,
      assessment.scope,
      assessment.plan_revision_id,
      assessment.section_id,
      assessment.unit_id,
      last.n + 1,
      entryRoute,
      assessment.scope === 'section_final' ? 'pending' : null,
      items.reduce(
        (sum: number, i: { max_points: number }) => sum + i.max_points,
        0,
      ),
      assessment.scope === 'section_final' ? 90 : null,
      assessment.policy_snapshot,
      hash(assessment.policy_snapshot),
      seen.length > 0,
    ],
  );
  for (const item of items)
    await m.query(
      'INSERT INTO teacher_responses(id,session_id,attempt_id,assessment_id,item_id,assistance) VALUES($1,$2,$3,$4,$5,$6)',
      [randomUUID(), s.id, id, assessmentId, item.id,
        JSON.stringify(seenByItem.has(item.id) ? { previously_seen_item: true, previous_response_id: seenByItem.get(item.id) } : {})],
    );
  return { kind: 'attempt', resource_id: id, attempt_id: id, revision: 1 };
}
function fingerprint(item: AssessmentCandidate['items'][number]) {
  return hash({
    kind: item.kind,
    prompt: item.prompt
      .normalize('NFC')
      .trim()
      .replace(/\s+/gu, ' ')
      .toLocaleLowerCase('und'),
    options:
      item.options
        ?.map((o) => o.label.normalize('NFC').trim().toLocaleLowerCase('und'))
        .sort() ?? null,
  });
}
export async function publishAssessment(
  m: EntityManager,
  s: TeacherSessionRow,
  jobId: string | null,
  candidate: AssessmentCandidate,
  slots: BlueprintSlot[],
  policy: AssessmentPolicy,
  contentId: string | null,
  diagnosticBlueprintId: string | null = null,
) {
  const id = randomUUID();
  const allFingerprints = candidate.items.map(fingerprint);
  const variantGroups = candidate.items.map((item) =>
    hash(
      item.prompt
        .normalize('NFC')
        .trim()
        .replace(/\s+/gu, ' ')
        .toLocaleLowerCase('und'),
    ),
  );
  if (new Set(allFingerprints).size !== allFingerprints.length)
    teacherError('invalid_generated_content', 422);
  if (candidate.scope === 'section_final') {
    const [seen]: { n: string }[] = await m.query(
      'SELECT count(*)::text AS n FROM teacher_assessment_items i JOIN teacher_assessments a ON a.id=i.assessment_id JOIN teacher_attempts t ON t.assessment_id=a.id WHERE a.session_id=$1 AND a.section_id=$2 AND (i.item_fingerprint=ANY($3::text[]) OR i.variant_group=ANY($4::text[]))',
      [s.id, candidate.section_id, allFingerprints, variantGroups],
    );
    if (Number(seen.n) > 0) teacherError('invalid_generated_content', 422);
  }
  const [last]: { n: number }[] = await m.query(
    'SELECT coalesce(max(version_no),0)::integer AS n FROM teacher_assessments WHERE session_id=$1 AND scope=$2 AND plan_revision_id IS NOT DISTINCT FROM $3::uuid AND section_id IS NOT DISTINCT FROM $4::uuid AND unit_id IS NOT DISTINCT FROM $5::uuid',
    [
      s.id,
      candidate.scope,
      candidate.plan_revision_id,
      candidate.section_id,
      candidate.unit_id,
    ],
  );
  await m.query(
    `INSERT INTO teacher_assessments(id,session_id,plan_revision_id,section_id,unit_id,content_version_id,scope,version_no,policy_version,policy_snapshot,coverage,coverage_hash,generation_job_id,status,diagnostic_blueprint_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'ready',$14)`,
    [
      id,
      s.id,
      candidate.plan_revision_id,
      candidate.section_id,
      candidate.unit_id,
      contentId,
      candidate.scope,
      last.n + 1,
      policy.version,
      policy,
      JSON.stringify(slots),
      hash(slots),
      jobId,
      diagnosticBlueprintId,
    ],
  );
  for (let i = 0; i < candidate.items.length; i++) {
    const item = candidate.items[i],
      slot = slots[i],
      itemId = randomUUID();
    const publicQuestion = {
      prompt: item.prompt,
      ...(item.options ? { options: item.options } : {}),
      ...(item.kind === 'short_text'
        ? {
            criteria: [
              { criterion_id: 'objective' },
              { criterion_id: 'accuracy' },
              { criterion_id: 'clarity' },
            ],
          }
        : {}),
    };
    await m.query(
      'INSERT INTO teacher_assessment_items(id,session_id,assessment_id,ordinal,kind,objective_ids,public_question,max_points,item_fingerprint,variant_group) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [
        itemId,
        s.id,
        id,
        i + 1,
        item.kind,
        [item.objective_id],
        publicQuestion,
        slot.max_points,
        allFingerprints[i],
        variantGroups[i],
      ],
    );
    await m.query(
      'INSERT INTO teacher_assessment_keys(item_id,session_id,assessment_id,private_key,expected_explanation,hint,key_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        itemId,
        s.id,
        id,
        item.private_key,
        item.explanation,
        item.hint ?? null,
        hash({ key: item.private_key, explanation: item.explanation }),
      ],
    );
  }
  return id;
}
export async function updateAttemptGrade(
  m: EntityManager,
  session: TeacherSessionRow,
  attemptId: string,
) {
  const [a] = await m.query(
    'SELECT * FROM teacher_attempts WHERE session_id=$1 AND id=$2 FOR UPDATE',
    [session.id, attemptId],
  );
  if (!a || !a.is_active) return;
  const rows = await m.query(
    'SELECT r.grade_state,r.earned_points,i.max_points FROM teacher_responses r JOIN teacher_assessment_items i ON i.id=r.item_id WHERE r.attempt_id=$1',
    [attemptId],
  );
  const result = aggregateGrade(
    a.scope,
    a.denominator_points,
    rows,
    a.assisted,
  );
  await m.query(
    "UPDATE teacher_attempts SET state=$2,result=$3,earned_points=$4,is_active=($2<>'graded'),closed_at=CASE WHEN $2='graded' THEN clock_timestamp() ELSE closed_at END,graded_at=CASE WHEN $2='graded' THEN clock_timestamp() ELSE NULL END,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
    [attemptId, result.state, result.result, result.earned_points],
  );
  if (result.result === 'passed') {
    const [section] = await m.query(
      'SELECT semantic_hash FROM teacher_sections WHERE session_id=$1 AND plan_revision_id=$2 AND id=$3',
      [session.id, a.plan_revision_id, a.section_id],
    );
    await m.query(
      'INSERT INTO teacher_section_verifications(id,session_id,plan_revision_id,section_id,semantic_hash,source_attempt_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(session_id,plan_revision_id,section_id) DO NOTHING',
      [
        randomUUID(),
        session.id,
        a.plan_revision_id,
        a.section_id,
        section.semantic_hash,
        attemptId,
      ],
    );
    const [complete]: { done: boolean }[] = await m.query(
      'SELECT EXISTS(SELECT 1 FROM teacher_sections WHERE session_id=$1 AND plan_revision_id=$2 AND required) AND NOT EXISTS(SELECT 1 FROM teacher_sections s WHERE s.session_id=$1 AND s.plan_revision_id=$2 AND s.required AND NOT EXISTS(SELECT 1 FROM teacher_section_verifications v WHERE v.session_id=s.session_id AND v.plan_revision_id=s.plan_revision_id AND v.section_id=s.id)) AS done',
      [session.id, session.current_plan_revision_id],
    );
    if (complete.done)
      await m.query(
        "UPDATE teacher_sessions SET state=CASE WHEN state IN ('paused','archived') THEN state ELSE 'completed' END,resume_state=CASE WHEN state='paused' OR (state='archived' AND archived_state='paused') THEN 'completed' ELSE resume_state END,archived_state=CASE WHEN state='archived' AND archived_state<>'paused' THEN 'completed' ELSE archived_state END,revision=revision+1,updated_at=clock_timestamp() WHERE id=$1",
        [session.id],
      );
  }
  return result;
}
