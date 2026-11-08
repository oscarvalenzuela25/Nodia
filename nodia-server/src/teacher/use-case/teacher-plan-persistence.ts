import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type {
  PlanOutline,
  PrivateGuide,
  TeacherSessionRow,
} from '../types/teacher.types.js';
import { hash, teacherError } from '../policies/teacher-validation.js';

export interface PlanRevisionRow {
  id: string;
  session_id: string;
  revision_no: number;
  state: string;
  outline: PlanOutline;
  private_guide: PrivateGuide;
  content_hash: string;
  base_revision_id: string | null;
  base_hash: string | null;
  assessment_policy: PlanOutline['assessment_policy'];
}
export function outlineIds(plan: PlanOutline): Set<string> {
  return new Set(
    plan.sections.flatMap((s) => [
      s.id,
      ...s.objectives.map((o) => o.id),
      ...s.units.map((u) => u.id),
    ]),
  );
}
export async function saveProposal(
  m: EntityManager,
  s: TeacherSessionRow,
  actorId: string,
  plan: PlanOutline,
  guide: PrivateGuide,
  base: PlanRevisionRow | null,
  jobId: string | null = null,
  candidate = false,
) {
  const [last]: { n: number }[] = await m.query(
    'SELECT coalesce(max(revision_no),0)::integer AS n FROM teacher_plan_revisions WHERE session_id=$1',
    [s.id],
  );
  if (last.n >= 2147483647) teacherError('revision_conflict');
  const id = randomUUID(),
    digest = hash({ outline: plan, guide });
  await m.query(
    'INSERT INTO teacher_plan_revisions(id,session_id,revision_no,base_revision_id,state,origin,outline,private_guide,assessment_policy,content_hash,base_hash,generation_job_id,created_by_actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
    [
      id,
      s.id,
      last.n + 1,
      base?.id ?? null,
      candidate ? 'candidate' : 'draft',
      jobId ? 'ai' : 'manual',
      plan,
      guide,
      plan.assessment_policy,
      digest,
      base?.content_hash ?? null,
      jobId,
      actorId,
    ],
  );
  return {
    id,
    proposal_revision_id: id,
    revision_no: last.n + 1,
    content_hash: digest,
    state: candidate ? 'candidate' : 'draft',
    base_revision_id: base?.id ?? null,
    base_hash: base?.content_hash ?? null,
  };
}
export function sectionHashes(plan: PlanOutline): Map<string, string> {
  const hashes = new Map<string, string>();
  const visit = (id: string): string => {
    if (hashes.has(id)) return hashes.get(id)!;
    const s = plan.sections.find((s) => s.id === id)!;
    const digest = hash({
      objectives: s.objectives.map((o) => ({
        id: o.id,
        description: o.description,
      })),
      prerequisites: s.prerequisite_section_ids.map(visit),
      units: s.units.map((u) => ({ id: u.id, objective_ids: u.objective_ids })),
      policy: plan.assessment_policy,
    });
    hashes.set(id, digest);
    return digest;
  };
  plan.sections.forEach((s) => visit(s.id));
  return hashes;
}
export async function projectAcceptedPlan(
  m: EntityManager,
  s: TeacherSessionRow,
  p: PlanRevisionRow,
) {
  const hashes = sectionHashes(p.outline);
  for (let si = 0; si < p.outline.sections.length; si++) {
    const section = p.outline.sections[si];
    await m.query(
      'INSERT INTO teacher_sections(session_id,plan_revision_id,id,title,ordinal,required,semantic_hash) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        s.id,
        p.id,
        section.id,
        section.title,
        si + 1,
        section.required,
        hashes.get(section.id),
      ],
    );
  }
  for (const section of p.outline.sections) {
    for (let oi = 0; oi < section.objectives.length; oi++) {
      const o = section.objectives[oi];
      await m.query(
        'INSERT INTO teacher_objectives(session_id,plan_revision_id,section_id,id,ordinal,description) VALUES($1,$2,$3,$4,$5,$6)',
        [s.id, p.id, section.id, o.id, oi + 1, o.description],
      );
    }
    for (let ui = 0; ui < section.units.length; ui++) {
      const u = section.units[ui];
      await m.query(
        'INSERT INTO teacher_units(session_id,plan_revision_id,section_id,id,title,ordinal,day_start,day_end,semantic_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [
          s.id,
          p.id,
          section.id,
          u.id,
          u.title,
          ui + 1,
          u.day_start,
          u.day_end,
          hash({ objective_ids: u.objective_ids }),
        ],
      );
      for (const objective of u.objective_ids)
        await m.query(
          'INSERT INTO teacher_unit_objectives(session_id,plan_revision_id,section_id,unit_id,objective_id) VALUES($1,$2,$3,$4,$5)',
          [s.id, p.id, section.id, u.id, objective],
        );
    }
    for (const required of section.prerequisite_section_ids)
      await m.query(
        'INSERT INTO teacher_section_prerequisites(session_id,plan_revision_id,section_id,required_section_id) VALUES($1,$2,$3,$4)',
        [s.id, p.id, section.id, required],
      );
  }
  // Reuse only identical semantic evidence and valid dependencies, in topological passes.
  if (s.current_plan_revision_id) {
    const inherited = new Set<string>();
    for (let pass = 0; pass < p.outline.sections.length; pass++)
      for (const section of p.outline.sections) {
        if (
          inherited.has(section.id) ||
          section.prerequisite_section_ids.some((id) => !inherited.has(id))
        )
          continue;
        const [prior] = await m.query(
          'SELECT * FROM teacher_section_verifications WHERE session_id=$1 AND plan_revision_id=$2 AND section_id=$3 AND semantic_hash=$4',
          [
            s.id,
            s.current_plan_revision_id,
            section.id,
            hashes.get(section.id),
          ],
        );
        if (prior) {
          await m.query(
            'INSERT INTO teacher_section_verifications(id,session_id,plan_revision_id,section_id,semantic_hash,source_attempt_id,source_verification_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [
              randomUUID(),
              s.id,
              p.id,
              section.id,
              hashes.get(section.id),
              prior.source_attempt_id,
              prior.id,
            ],
          );
          inherited.add(section.id);
        }
      }
  }
}
