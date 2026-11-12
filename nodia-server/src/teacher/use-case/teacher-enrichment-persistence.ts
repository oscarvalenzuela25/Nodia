import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type {
  TeacherGenerationJob,
  TeacherSessionRow,
} from '../types/teacher.types.js';
import {
  hash,
  object,
  parseJsonOutput,
  requireUuid,
  teacherError,
  text,
} from '../policies/teacher-validation.js';
import { admittedEnrichmentCitations } from '../policies/teacher-enrichment-citations.js';
import { learningSnapshot } from './teacher-learning-persistence.js';
import { uuidPattern } from '../policies/teacher-validation.js';

export interface EnrichmentRecord {
  id: string;
  session_id: string;
  kind: string;
  revision: number;
  data: Record<string, unknown>;
  created_at: Date;
}
export async function enrichmentRecord(
  m: EntityManager,
  sessionId: string,
  id: unknown,
  kind: string,
  lock = false,
): Promise<EnrichmentRecord> {
  const [row]: EnrichmentRecord[] = await m.query(
    `SELECT * FROM teacher_enrichment_records WHERE session_id=$1 AND id=$2 AND kind=$3 ${lock ? 'FOR UPDATE' : ''}`,
    [sessionId, requireUuid(id), kind],
  );
  if (!row) teacherError('not_found', 404);
  return row;
}
export async function rejectFinalHelp(
  m: EntityManager,
  sessionId: string,
): Promise<void> {
  const [row]: { exists: boolean }[] = await m.query(
    "SELECT EXISTS(SELECT 1 FROM teacher_attempts WHERE session_id=$1 AND scope='section_final' AND is_active) AS exists",
    [sessionId],
  );
  if (row.exists) teacherError('helper_unavailable_during_final', 409);
}
export async function readAnchor(
  m: EntityManager,
  sessionId: string,
  data: Record<string, unknown>,
): Promise<string> {
  const [row]: { public_blocks: { id: string; body_markdown: string }[] }[] =
    await m.query(
      'SELECT public_blocks FROM teacher_content_versions WHERE session_id=$1 AND id=$2',
      [sessionId, requireUuid(data.content_version_id)],
    );
  const block = row?.public_blocks.find((b) => b.id === data.block_id);
  if (
    !block ||
    typeof data.selection !== 'string' ||
    !block.body_markdown.includes(data.selection)
  )
    teacherError('invalid_anchor', 409);
  return block.body_markdown;
}
export async function publishEnrichmentReply(
  m: EntityManager,
  job: TeacherGenerationJob,
  output: string,
): Promise<Record<string, unknown>> {
  const v = object(parseJsonOutput(output), ['schema_version', 'text']);
  if (v.schema_version !== 1) teacherError('invalid_generated_content', 422);
  const reply = text(v.text, 1, 4000);
  await m.query(
    'SELECT revision FROM teacher_enrichment_states WHERE session_id=$1 FOR UPDATE',
    [job.session_id],
  );
  const thread = await enrichmentRecord(
    m,
    job.session_id,
    job.input_snapshot.thread_id,
    'thread',
    true,
  );
  await rejectFinalHelp(m, job.session_id);
  const block = await readAnchor(m, job.session_id, thread.data);
  if (
    hash({ block, selection: thread.data.selection }) !==
    job.input_snapshot.anchor_hash
  )
    teacherError('invalid_anchor', 409);
  await m.query(
    "INSERT INTO teacher_enrichment_events(id,session_id,record_id,kind,data) VALUES($1,$2,$3,'message',$4) ON CONFLICT DO NOTHING",
    [
      randomUUID(),
      job.session_id,
      thread.id,
      { role: 'assistant', text: reply, job_id: job.id },
    ],
  );
  // Reading a helper answer is assistance, never proof of understanding.
  // Attempt-level tagging does not overwrite response drafts or their CAS revisions.
  await m.query(
    "UPDATE teacher_attempts t SET assisted=true WHERE t.session_id=$1 AND t.scope='unit_practice' AND t.is_active AND EXISTS(SELECT 1 FROM teacher_assessments a WHERE a.session_id=t.session_id AND a.id=t.assessment_id AND a.content_version_id=$2)",
    [job.session_id, thread.data.content_version_id],
  );
  await m.query(
    'UPDATE teacher_enrichment_states SET revision=revision+1 WHERE session_id=$1',
    [job.session_id],
  );
  return {
    kind: 'clarification',
    resource_id: thread.id,
    thread_id: thread.id,
  };
}

/** Relevance is a deterministic lexical hint, never a claim of factual truth. */
export async function enrichmentGenerationContext(
  m: EntityManager,
  session: TeacherSessionRow,
) {
  const sourceRows: EnrichmentRecord[] = await m.query(
    "SELECT * FROM teacher_enrichment_records WHERE session_id=$1 AND kind='source' ORDER BY created_at DESC,id DESC LIMIT 3",
    [session.id],
  );
  const terms = [
    ...new Set(
      `${session.topic} ${session.objective}`
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length >= 3),
    ),
  ].slice(0, 32);
  let remaining = 10000;
  const sources = sourceRows
    .map((source) => {
      const pages = source.data.pages as { page: number; text: string }[];
      const selected = pages
        .map((page) => ({
          ...page,
          score: terms.reduce(
            (sum, term) =>
              sum + (page.text.toLowerCase().includes(term) ? 1 : 0),
            0,
          ),
        }))
        .sort((a, b) => b.score - a.score || a.page - b.page)
        .slice(0, 3);
      return {
        source_id: source.id,
        title: source.data.title,
        content_hash: source.data.content_hash,
        pages: selected.flatMap((page) => {
          const excerpt = page.text.slice(0, Math.min(2000, remaining));
          remaining -= excerpt.length;
          return excerpt
            ? [
                {
                  page: page.page,
                  text: excerpt,
                  excerpt: excerpt.length !== page.text.length,
                },
              ]
            : [];
        }),
      };
    })
    .filter((source) => source.pages.length > 0);
  const concepts: EnrichmentRecord[] = await m.query(
    "SELECT * FROM teacher_enrichment_records WHERE session_id=$1 AND kind='concept' ORDER BY created_at DESC,id DESC LIMIT 12",
    [session.id],
  );
  const equivalences = await acceptedEnrichmentEquivalences(m, session);
  let budget = 24000;
  const bounded = <T>(items: T[]): T[] =>
    items.filter((item) => {
      const bytes = Buffer.byteLength(JSON.stringify(item));
      if (bytes > budget) return false;
      budget -= bytes;
      return true;
    });
  const selectedSources = bounded(sources);
  const selectedConcepts = bounded(
    concepts.map((c) => ({
      concept_id: c.id,
      label: c.data.label,
      statement: c.data.statement,
      conditions: c.data.conditions,
      objective_id: c.data.objective_id ?? null,
      plan_revision_id: c.data.plan_revision_id ?? null,
      origin: 'user_authored',
      grants_verification: false,
    })),
  );
  const selectedEquivalences = bounded(equivalences);
  const evidence = await mappedEnrichmentEvidence(m, session);
  const selectedEvidence = bounded(evidence);
  return {
    selection_policy: 'teacher-enrichment-context/1',
    context_budget_bytes: 24000,
    sources: selectedSources,
    concepts: selectedConcepts,
    equivalences: selectedEquivalences,
    mapped_evidence: selectedEvidence,
    excluded_from_candidates: {
      sources: sources.length - selectedSources.length,
      concepts: concepts.length - selectedConcepts.length,
      equivalences: equivalences.length - selectedEquivalences.length,
      mapped_evidence: evidence.length - selectedEvidence.length,
    },
  };
}

/** Reuse references across reviewed equivalences; never copy grades or verification. */
async function mappedEnrichmentEvidence(
  m: EntityManager,
  session: TeacherSessionRow,
) {
  const rows: {
    evidence_id: string;
    source_session_id: string;
    source_objective_id: string;
    target_objective_id: string;
    response_id: string;
    attempt_id: string;
    plan_revision_id: string;
    answer_state: string;
    assisted: boolean;
    observed_at: Date;
    equivalence_id: string;
    description: string;
  }[] = await m.query(
    `
    SELECT DISTINCT ON (ev.response_id,ev.objective_id,e.id) ev.id AS evidence_id,ev.session_id AS source_session_id,ev.objective_id AS source_objective_id,
      f.data->>'objective_id' AS target_objective_id,ev.response_id,ev.attempt_id,ev.plan_revision_id,ev.answer_state,ev.assisted,ev.observed_at,e.id AS equivalence_id,ev.description
    FROM teacher_enrichment_records e
    JOIN teacher_enrichment_records f ON f.id=(e.data->>'from_concept_id')::uuid AND f.session_id=e.session_id AND f.kind='concept'
    JOIN teacher_enrichment_records t ON t.id=(e.data->>'to_concept_id')::uuid AND t.kind='concept'
    JOIN teacher_sessions s ON s.id=t.session_id AND s.owner_user_id=$2
    JOIN teacher_learning_evidence ev ON ev.session_id=t.session_id AND ev.objective_id::text=t.data->>'objective_id' AND ev.plan_revision_id=s.current_plan_revision_id
    WHERE e.session_id=$1 AND e.kind='equivalence' AND e.data->>'state'='accepted' AND f.data->>'objective_id' IS NOT NULL
      AND f.data->>'plan_revision_id'=$3::text AND t.data->>'plan_revision_id'=s.current_plan_revision_id::text
    ORDER BY ev.response_id,ev.objective_id,e.id,CASE ev.answer_state WHEN 'graded' THEN 0 WHEN 'needs_review' THEN 1 ELSE 2 END,ev.observed_at DESC LIMIT 12`,
    [session.id, session.owner_user_id, session.current_plan_revision_id],
  );
  return rows.map((row) => ({
    ...row,
    observed_at: row.observed_at.toISOString(),
    interpretation: 'reviewed_equivalence_reference',
    modality: 'written',
    relevance_policy: 'current_revisions_only_no_age_mastery_claim',
    grants_verification: false,
    transfers_grade: false,
  }));
}

export async function acceptedEnrichmentEquivalences(
  m: EntityManager,
  session: TeacherSessionRow,
) {
  const rows: {
    id: string;
    data: Record<string, unknown>;
    from_label: string;
    to_label: string;
    to_statement: string;
    target_session_id: string;
  }[] = await m.query(
    `SELECT e.id,e.data,f.data->>'label' AS from_label,t.data->>'label' AS to_label,t.data->>'statement' AS to_statement,t.session_id AS target_session_id
    FROM teacher_enrichment_records e
    JOIN teacher_enrichment_records f ON f.id=(e.data->>'from_concept_id')::uuid AND f.kind='concept' AND f.session_id=e.session_id
    JOIN teacher_enrichment_records t ON t.id=(e.data->>'to_concept_id')::uuid AND t.kind='concept'
    JOIN teacher_sessions s ON s.id=t.session_id AND s.owner_user_id=$2
    WHERE e.session_id=$1 AND e.kind='equivalence' AND e.data->>'state'='accepted' ORDER BY e.created_at DESC,e.id DESC LIMIT 12`,
    [session.id, session.owner_user_id],
  );
  return rows.map((r) => ({
    id: r.id,
    ...r.data,
    from_label: r.from_label,
    to_label: r.to_label,
    to_statement: r.to_statement,
    target_session_id: r.target_session_id,
    grants_verification: false,
  }));
}

export async function validateEnrichmentCitations(
  m: EntityManager,
  sessionId: string,
  value: unknown,
  admittedContext: unknown,
) {
  const citations = admittedEnrichmentCitations(value, admittedContext);
  const ids = [...new Set(citations.map((c) => c.source_id))];
  const rows: EnrichmentRecord[] = ids.length
    ? await m.query(
        "SELECT * FROM teacher_enrichment_records WHERE session_id=$1 AND kind='source' AND id=ANY($2::uuid[])",
        [sessionId, ids],
      )
    : [];
  const sources = new Map(rows.map((row) => [row.id, row]));
  for (const citation of citations) {
    const source = sources.get(citation.source_id);
    const page = (
      source?.data.pages as { page: number; text: string }[] | undefined
    )?.find((p) => p.page === citation.page);
    if (
      !source ||
      source.data.content_hash !== citation.content_hash ||
      !page ||
      !page.text.includes(citation.quote)
    )
      teacherError('invalid_generated_content', 422);
  }
  return citations;
}

export async function validateConceptSourceRefs(m: EntityManager, sessionId: string, value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3) teacherError('invalid_input', 400);
  const ids = value.map(raw => requireUuid(object(raw, ['source_id', 'content_hash', 'page', 'quote']).source_id));
  const rows: EnrichmentRecord[] = ids.length ? await m.query(
    "SELECT * FROM teacher_enrichment_records WHERE session_id=$1 AND kind='source' AND id=ANY($2::uuid[])", [sessionId, ids]) : [];
  const admitted = { sources: rows.map(row => ({ source_id: row.id, content_hash: row.data.content_hash, pages: row.data.pages })) };
  return validateEnrichmentCitations(m, sessionId, value, admitted);
}

/** Projections retain separate observations. Null is unknown, never a zero mastery score. */
export async function conceptLearningStates(m: EntityManager, session: TeacherSessionRow, concepts: EnrichmentRecord[]) {
  const result = new Map<string, Record<string, unknown>>();
  if (!concepts.length) return result;
  const learning = await learningSnapshot(m, session, session.current_plan_revision_id, { unitId: null });
  const progress: { unit_id: string; content_version_id: string; updated_at: Date }[] = await m.query(
    `SELECT unit_id,content_version_id,updated_at FROM teacher_unit_progress WHERE session_id=$1 AND plan_revision_id=$2
      AND jsonb_array_length(visited_block_ids)>0 ORDER BY updated_at DESC LIMIT 60`, [session.id, session.current_plan_revision_id]);
  const verifications: { id: string; section_id: string; source_attempt_id: string; verified_at: Date }[] = await m.query(
    'SELECT id,section_id,source_attempt_id,verified_at FROM teacher_section_verifications WHERE session_id=$1 AND plan_revision_id=$2 LIMIT 24',
    [session.id, session.current_plan_revision_id]);
  const origins: { response_id: string; question_id: string }[] = learning.observations.length ? await m.query(
    'SELECT id AS response_id,item_id AS question_id FROM teacher_responses WHERE session_id=$1 AND id=ANY($2::uuid[])',
    [session.id, learning.observations.map(e => e.response_id)]) : [];
  for (const concept of concepts) {
    const current = concept.data.plan_revision_id === session.current_plan_revision_id && session.current_plan_revision_id !== null;
    const objective = current ? learning.objectives.find(o => o.objective_id === concept.data.objective_id) : null;
    const evidence = objective ? learning.observations.filter(e => e.objective_id === objective.objective_id && e.plan_revision_id === session.current_plan_revision_id).slice(0, 6) : [];
    const immediate = evidence.find(e => e.answer_state === 'graded');
    const independent = evidence.find(e => e.independent && e.answer_state === 'graded' && e.earned_points === e.max_points);
    const visit = objective ? progress.find(p => objective.unit_ids.includes(p.unit_id)) : null;
    const verification = objective ? verifications.find(v => v.section_id === objective.section_id) : null;
    result.set(concept.id, {
      policy_version: 'teacher-concept-observations/1',
      visited: visit ? { kind: 'material_visit', unit_id: visit.unit_id, content_version_id: visit.content_version_id, observed_at: visit.updated_at.toISOString() } : null,
      immediate_check: immediate ?? null,
      independent_application: independent ?? null,
      retention: null,
      section_verification: verification ? { verification_id: verification.id, source_attempt_id: verification.source_attempt_id, verified_at: verification.verified_at.toISOString() } : null,
      latest_evidence: evidence,
      evidence_origins: evidence.flatMap(e => {
        const origin = origins.find(r => r.response_id === e.response_id);
        return origin ? [{ observation_id: e.id, response_id: e.response_id, attempt_id: e.attempt_id, question_id: origin.question_id }] : [];
      }),
      grants_verification: false,
    });
  }
  return result;
}

/** Focal references are resolved in a single owner-scoped query, not by traversing a graph. */
export async function conceptProvenance(m: EntityManager, session: TeacherSessionRow, concepts: EnrichmentRecord[]) {
  const relationRows = new Map<string, Record<string, unknown>[]>();
  for (const concept of concepts) relationRows.set(concept.id, Array.isArray(concept.data.relations)
    ? concept.data.relations.filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object' && !Array.isArray(r)).slice(0, 8) : []);
  const ids = [...new Set([...relationRows.values()].flatMap(relations => relations.flatMap(relation =>
    Array.isArray(relation.target_concept_ids) ? relation.target_concept_ids.filter((id): id is string => typeof id === 'string' && uuidPattern.test(id)).slice(0, 4) : [])))].slice(0, 64);
  const targets: { id: string; session_id: string; data: Record<string, unknown> }[] = ids.length ? await m.query(
    "SELECT r.id,r.session_id,r.data FROM teacher_enrichment_records r JOIN teacher_sessions s ON s.id=r.session_id WHERE r.id=ANY($1::uuid[]) AND r.kind='concept' AND s.owner_user_id=$2",
    [ids, session.owner_user_id]) : [];
  const history: { id: string; equivalence_id: string; created_at: Date; data: Record<string, unknown> }[] = concepts.length ? await m.query(
    `SELECT ev.id,e.id AS equivalence_id,ev.created_at,ev.data FROM teacher_enrichment_events ev
      JOIN teacher_enrichment_records e ON e.session_id=ev.session_id AND e.id=ev.record_id AND e.kind='equivalence'
      JOIN teacher_sessions s ON s.id=e.session_id AND s.owner_user_id=$2
      WHERE ev.kind='equivalence' AND (e.data->>'from_concept_id'=ANY($1::text[]) OR e.data->>'to_concept_id'=ANY($1::text[]))
      ORDER BY ev.created_at DESC,ev.id DESC LIMIT 64`, [concepts.map(c => c.id), session.owner_user_id]) : [];
  return new Map(concepts.map(concept => [concept.id, {
    relations: (relationRows.get(concept.id) ?? []).map(relation => ({
      kind: relation.kind,
      combination: 'all',
      status: 'proposed',
      origin: 'user_authored',
      target_concept_ids: Array.isArray(relation.target_concept_ids) ? relation.target_concept_ids.slice(0, 4) : [],
      targets: targets.filter(target => Array.isArray(relation.target_concept_ids) && relation.target_concept_ids.includes(target.id)).map(target => ({
        id: target.id, session_id: target.session_id, label: target.data.label,
        statement: target.data.statement, conditions: target.data.conditions,
        objective_id: target.data.objective_id ?? null, plan_revision_id: target.data.plan_revision_id ?? null,
      })),
      grants_verification: false,
    })),
    source_refs: Array.isArray(concept.data.source_refs) ? concept.data.source_refs.slice(0, 3) : [],
    equivalence_history: history.filter(event => event.data.from_concept_id === concept.id || event.data.to_concept_id === concept.id)
      .slice(0, 12).map(event => ({ id: event.id, equivalence_id: event.equivalence_id,
        observed_at: event.created_at.toISOString(), ...event.data })),
    relation_preview_limit: 64,
  }]));
}
