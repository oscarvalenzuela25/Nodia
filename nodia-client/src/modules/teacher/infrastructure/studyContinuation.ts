import { enabled } from "./presentation";
import type { AllowedActions, Cursor, Material, Plan } from "./schemas";

export type StudyTarget = { sectionId: string; unitId: string; title: string };
export type StudyContinuationKind = "first" | "prepare" | "open" | "continue" | "job" | "preparing" | "unknown" | "unavailable" | "historical" | "empty";
export type StudyContinuation = {
  kind: StudyContinuationKind;
  target: StudyTarget | null;
  jobId: string | null;
  firstLesson: boolean;
  canPrepare: boolean;
};
export type StudyContinuationContext = {
  plan: Plan;
  cursor: Cursor;
  selectedUnitId: string | null;
  /** The already-restored local attempt, not the first entry of active_attempts. */
  attemptId: string | null;
  /** Available only once that exact attempt has been read from the Server. */
  attemptPlanRevisionId?: string | null;
  material?: Material;
  allowedActions: AllowedActions;
  paused: boolean;
};

/** Presentation only: never selects a unit, rewrites a cursor or starts a generation. */
export function studyContinuation(context: StudyContinuationContext): StudyContinuation {
  const { plan, cursor, selectedUnitId, attemptId, attemptPlanRevisionId, material, allowedActions, paused } = context;
  const units = plan.outline.sections.flatMap(section => section.units.map(unit => ({
    sectionId: section.id, unitId: unit.id, title: unit.title,
  })));
  const targetId = selectedUnitId ?? cursor.unit_id;
  const target = targetId === null ? units[0] ?? null : units.find(unit => unit.unitId === targetId) ?? null;
  const firstLesson = Boolean(target && target.unitId === units[0]?.unitId && !cursor.block_id && !attemptId && !cursor.attempt_id);
  const view = (kind: StudyContinuationKind, jobId: string | null = null): StudyContinuation => ({
    kind, target, jobId, firstLesson, canPrepare: !paused && enabled(allowedActions, "prepare_unit"),
  });
  // A historical cursor must not silently become the first unit of a new plan.
  if (cursor.plan_revision_id !== null && cursor.plan_revision_id !== plan.id) return view("historical");
  if (attemptId && attemptPlanRevisionId != null && attemptPlanRevisionId !== plan.id) return view("historical");
  if (attemptId) return view("continue");
  if (!target) return view(targetId === null ? "empty" : "unavailable");
  if (targetId === null) return view("first");
  if (!material) return view("unavailable");
  if (material.kind === "material") {
    if (material.plan_revision_id !== plan.id || material.unit_id !== target.unitId) return view("unavailable");
    const savedBlockExists = material.blocks.some(block => block.id === cursor.block_id);
    return view(cursor.unit_id === target.unitId && cursor.content_version_id === material.content_version_id && savedBlockExists ? "continue" : "open");
  }
  // Any job reference requires its recovery UI: even not_prepared can reference a
  // failed/unknown/ready job, and must not be treated as a fresh generation.
  if (material.job_id) return view("job", material.job_id);
  if (material.state === "not_prepared") return view("prepare");
  return view(material.state === "preparing" ? "preparing" : "unknown");
}
