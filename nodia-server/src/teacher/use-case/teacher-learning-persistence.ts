import type { EntityManager } from 'typeorm';
import type { PlanOutline, TeacherSessionRow } from '../types/teacher.types.js';
import {
  LEARNING_POLICY,
  type LearningObservation,
  type LearningObjective,
  type LearningBlueprint,
} from '../types/teacher-learning.types.js';
import { recommendLearning } from '../policies/teacher-learning.js';
import { hash } from '../policies/teacher-validation.js';

/** Append distinct grading events. Never reinterpret legacy responses as confidence or explanation. */
export async function refreshLearningEvidence(
  m: EntityManager,
  sessionId: string,
) {
  await m.query(
    `INSERT INTO teacher_learning_evidence(id,session_id,response_id,attempt_id,objective_id,description,plan_revision_id,answer_state,earned_points,max_points,assisted,self_explanation,confidence,observed_at)
    SELECT gen_random_uuid(),$1,r.id,r.attempt_id,i.objective_ids[1],coalesce(o.description,d.dimension->>'description',''),a.plan_revision_id,
    r.grade_state,r.earned_points,i.max_points,(a.scope='diagnostic' OR a.assisted OR r.assistance<>'{}'::jsonb),r.self_explanation,r.confidence,r.submitted_at
    FROM (
      SELECT r.id FROM teacher_responses r JOIN teacher_attempts a ON a.id=r.attempt_id
      JOIN teacher_assessment_items i ON i.id=r.item_id
      WHERE r.session_id=$1 AND r.submitted_at IS NOT NULL AND r.grade_state IN ('pending','graded','needs_review')
      AND (a.scope<>'section_final' OR a.state<>'in_progress')
      AND NOT EXISTS(SELECT 1 FROM teacher_learning_evidence e WHERE e.response_id=r.id AND e.objective_id=i.objective_ids[1] AND e.answer_state=r.grade_state)
      ORDER BY r.submitted_at DESC,r.id LIMIT 128
    ) eligible JOIN teacher_responses r ON r.id=eligible.id
    JOIN teacher_attempts a ON a.id=r.attempt_id
    JOIN teacher_assessment_items i ON i.id=r.item_id JOIN teacher_assessments ass ON ass.id=a.assessment_id
    LEFT JOIN teacher_objectives o ON o.plan_revision_id=a.plan_revision_id AND o.id=i.objective_ids[1]
    LEFT JOIN teacher_learning_blueprints b ON b.id=ass.diagnostic_blueprint_id
    LEFT JOIN LATERAL (SELECT dimension FROM jsonb_array_elements(b.dimensions) dimension WHERE dimension->>'id'=i.objective_ids[1]::text LIMIT 1) d ON true
    ON CONFLICT(response_id,objective_id,answer_state) DO NOTHING`,
    [sessionId],
  );
}
export async function learningSnapshot(
  m: EntityManager,
  session: TeacherSessionRow,
  requestedPlanId: string | null = session.current_plan_revision_id,
  generationFocus?: { unitId: string | null },
) {
  const [plan]: { id: string; outline: PlanOutline }[] = requestedPlanId
    ? await m.query(
        'SELECT id,outline FROM teacher_plan_revisions WHERE session_id=$1 AND id=$2',
        [session.id, requestedPlanId],
      )
    : await m.query(
        "SELECT id,outline FROM teacher_plan_revisions WHERE session_id=$1 AND state IN ('draft','candidate') ORDER BY revision_no DESC LIMIT 1",
        [session.id],
      );
  const effectivePlanId = plan?.id ?? null;
  let objectives: LearningObjective[] = await m.query(
    `SELECT o.id AS objective_id,o.description,o.plan_revision_id,o.section_id,
    coalesce(array_agg(u.unit_id ORDER BY u.unit_id) FILTER(WHERE u.unit_id IS NOT NULL),'{}') AS unit_ids
    FROM teacher_objectives o LEFT JOIN teacher_unit_objectives u ON u.plan_revision_id=o.plan_revision_id AND u.objective_id=o.id
    WHERE o.session_id=$1 AND o.plan_revision_id=$2 GROUP BY o.id,o.description,o.plan_revision_id,o.section_id ORDER BY o.section_id,o.id LIMIT 128`,
    [session.id, effectivePlanId],
  );
  if (!objectives.length && plan)
    objectives = plan.outline.sections
      .flatMap((section) =>
        section.objectives.map((objective) => ({
          objective_id: objective.id,
          description: objective.description,
          plan_revision_id: plan.id,
          section_id: section.id,
          unit_ids: section.units
            .filter((unit) => unit.objective_ids.includes(objective.id))
            .map((unit) => unit.id),
        })),
      )
      .slice(0, 128);
  const observations: LearningObservation[] = await m.query(
    `SELECT * FROM (
    SELECT DISTINCT ON(e.response_id,coalesce(map.objective_id,e.objective_id)) e.id,
    coalesce(map.objective_id,e.objective_id) AS objective_id,coalesce(o.description,e.description) AS description,
    coalesce(map.plan_revision_id,e.plan_revision_id) AS plan_revision_id,e.answer_state,e.earned_points,e.max_points,e.assisted,
    (e.answer_state='graded' AND NOT e.assisted) AS independent,e.self_explanation,e.confidence,e.observed_at,e.attempt_id,e.response_id
    FROM teacher_learning_evidence e JOIN teacher_attempts a ON a.id=e.attempt_id
    JOIN teacher_assessments ass ON ass.id=a.assessment_id
    LEFT JOIN teacher_learning_mappings map ON map.session_id=e.session_id AND map.blueprint_id=ass.diagnostic_blueprint_id AND map.dimension_id=e.objective_id AND map.plan_revision_id=$2
    LEFT JOIN teacher_objectives o ON o.plan_revision_id=map.plan_revision_id AND o.id=map.objective_id
    WHERE e.session_id=$1 AND (a.scope<>'section_final' OR a.state<>'in_progress')
    AND (NOT $3::boolean OR (
      coalesce(map.plan_revision_id,e.plan_revision_id) IS NOT DISTINCT FROM $2::uuid
      AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM teacher_unit_objectives u
        WHERE u.session_id=e.session_id AND u.plan_revision_id=$2 AND u.unit_id=$4
          AND u.objective_id=coalesce(map.objective_id,e.objective_id)))))
    ORDER BY e.response_id,coalesce(map.objective_id,e.objective_id),CASE e.answer_state WHEN 'graded' THEN 3 WHEN 'needs_review' THEN 2 ELSE 1 END DESC,e.id DESC
    ) e ORDER BY observed_at DESC,id DESC LIMIT 100`,
    [session.id, effectivePlanId, generationFocus !== undefined, generationFocus?.unitId ?? null],
  );
  const [bank]: LearningBlueprint[] = await m.query(
    'SELECT * FROM teacher_learning_blueprints WHERE session_id=$1 ORDER BY revision DESC LIMIT 1',
    [session.id],
  );
  const interactions = await m.query(
    'SELECT id,content_version_id,block_id,kind,text,created_at FROM teacher_learning_interactions WHERE session_id=$1 ORDER BY created_at DESC,id DESC LIMIT 40',
    [session.id],
  );
  const mappings = await m.query(
    'SELECT blueprint_id,dimension_id,plan_revision_id,objective_id FROM teacher_learning_mappings WHERE session_id=$1 AND plan_revision_id=$2 ORDER BY blueprint_id,dimension_id,objective_id LIMIT 128',
    [session.id, effectivePlanId],
  );
  return {
    schema_version: 1,
    session_id: session.id,
    revision: session.revision,
    plan_revision_id: effectivePlanId,
    policy_version: LEARNING_POLICY,
    objectives,
    observations: observations.map((o) => ({
      ...o,
      observed_at: new Date(o.observed_at).toISOString(),
    })),
    recommendations: recommendLearning(objectives, observations),
    diagnostic_blueprint: bank
      ? {
          id: bank.id,
          revision: bank.revision,
          title: bank.title,
          dimensions: bank.dimensions,
          reviewed: bank.reviewed,
          item_count: bank.items.length,
        }
      : null,
    mappings,
    interactions,
  };
}

export async function learningGenerationContext(
  m: EntityManager,
  session: TeacherSessionRow,
  planRevisionId: string | null = session.current_plan_revision_id,
  unitId: string | null = null,
) {
  const snapshot = await learningSnapshot(m, session, planRevisionId, { unitId });
  const evidence = snapshot.observations
    .filter(
      (o) =>
        o.answer_state === 'graded' &&
        (snapshot.plan_revision_id
          ? o.plan_revision_id === snapshot.plan_revision_id
          : o.plan_revision_id === null),
    )
    .filter(
      (o) =>
        !unitId ||
        snapshot.objectives.some(
          (objective) =>
            objective.objective_id === o.objective_id &&
            objective.unit_ids.includes(unitId),
        ),
    )
    .slice(0, 12);
  const responseDetails = evidence.length
    ? await m.query(
        `SELECT r.id AS response_id,i.public_question,r.frozen_answer,r.feedback->>'explanation' AS feedback_explanation
    FROM teacher_responses r JOIN teacher_assessment_items i ON i.id=r.item_id JOIN teacher_attempts a ON a.id=r.attempt_id
    WHERE r.session_id=$1 AND r.id=ANY($2::uuid[]) AND r.submitted_at IS NOT NULL AND (a.scope<>'section_final' OR a.state<>'in_progress')
    ORDER BY r.submitted_at DESC,r.id LIMIT 6`,
        [session.id, evidence.map((o) => o.response_id)],
      )
    : [];
  const lessonInteractions: {
    id: string;
    content_version_id: string;
    block_id: string;
    kind: 'prediction' | 'check';
    text: string;
    created_at: Date | string;
    visible_block: unknown;
  }[] = await m.query(
    `SELECT i.id,i.content_version_id,i.block_id,i.kind,i.text,i.created_at,b.block AS visible_block
    FROM teacher_learning_interactions i JOIN teacher_content_versions c ON c.id=i.content_version_id AND c.session_id=i.session_id
    JOIN LATERAL (SELECT block FROM jsonb_array_elements(c.public_blocks) block WHERE block->>'id'=i.block_id LIMIT 1) b ON true
    WHERE i.session_id=$1 AND c.plan_revision_id=$2 AND ($3::uuid IS NULL OR c.unit_id=$3)
    ORDER BY i.created_at DESC,i.id DESC LIMIT 4`,
    [session.id, snapshot.plan_revision_id, unitId],
  );
  const value = {
    policy_version: LEARNING_POLICY,
    plan_revision_id: snapshot.plan_revision_id,
    evidence,
    response_details: responseDetails,
    lesson_interactions: lessonInteractions.map((interaction) => ({
      ...interaction,
      created_at: new Date(interaction.created_at).toISOString(),
    })),
    target_focus: snapshot.recommendations.filter(
      (r) =>
        !unitId ||
        snapshot.objectives.some(
          (o) =>
            o.objective_id === r.objective_id && o.unit_ids.includes(unitId),
        ),
    ),
    recommendations: snapshot.recommendations,
  };
  return { ...value, snapshot_hash: hash(value) };
}
