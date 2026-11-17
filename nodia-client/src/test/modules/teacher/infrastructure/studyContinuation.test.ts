import { describe, expect, it } from "vitest";
import { studyContinuation, type StudyContinuationContext } from "../../../../modules/teacher/infrastructure/studyContinuation";
import type { Material } from "../../../../modules/teacher/infrastructure/schemas";
import { planFixture } from "../fixtures";

// Synthetic Server projections; no provider or persistence is invoked.
const cursor = { revision: 1, phase: "setup" as const, plan_revision_id: planFixture.id, section_id: null,
  unit_id: null, content_version_id: null, attempt_id: null, item_id: null, block_id: null };
const material: Material = { kind: "material", resource_id: "fixture-resource", content_version_id: "fixture-version",
  plan_revision_id: planFixture.id, unit_id: "u1", blocks: [{ id: "fixture-block", title: "Fixture block", body_markdown: "Fixture content" }], allowed_actions: {} };
const context = (patch: Partial<StudyContinuationContext> = {}): StudyContinuationContext => ({
  plan: planFixture, cursor, selectedUnitId: null, attemptId: null, paused: false,
  allowedActions: { prepare_unit: { enabled: true, reason_code: null } }, ...patch,
});

describe("Teacher study continuation policy", () => {
  it("offers the first actual unit after acceptance without claiming material exists", () => {
    const result = studyContinuation(context());
    expect(result).toMatchObject({ kind: "first", target: { sectionId: "s1", unitId: "u1", title: "DNS" } });
    expect(cursor.unit_id).toBeNull();
  });
  it("takes the first unit from a nonempty section without inventing an empty section's unit", () => {
    const plan = { ...planFixture, outline: { ...planFixture.outline, sections: [{ ...planFixture.outline.sections[0], id: "empty", units: [] }, ...planFixture.outline.sections] } };
    expect(studyContinuation(context({ plan })).target?.sectionId).toBe("s1");
    expect(studyContinuation(context({ plan: { ...plan, outline: { ...plan.outline, sections: [] } } })).kind).toBe("empty");
  });
  it("prepares only explicitly missing material, requiring the exact reported action", () => {
    const missing: Material = { kind: "availability", state: "not_prepared", job_id: null };
    expect(studyContinuation(context({ selectedUnitId: "u1", material: missing }))).toMatchObject({ kind: "prepare", canPrepare: true, firstLesson: true });
    expect(studyContinuation(context({ selectedUnitId: "u1", material: missing, allowedActions: {} })).canPrepare).toBe(false);
    expect(studyContinuation(context({ selectedUnitId: "u1", material: missing, allowedActions: { prepare_unit: { enabled: false, reason_code: "fixture-denied" } } })).canPrepare).toBe(false);
    expect(studyContinuation(context({ selectedUnitId: "u1", material: missing, paused: true })).canPrepare).toBe(false);
  });
  it.each(["not_prepared", "preparing", "unknown"] as const)("routes %s with a job to recovery instead of starting another generation", state => {
    expect(studyContinuation(context({ selectedUnitId: "u1", material: { kind: "availability", state, job_id: "fixture-job" } }))).toMatchObject({ kind: "job", jobId: "fixture-job" });
  });
  it("keeps unknown, preparing and absent data distinct from missing material", () => {
    for (const state of ["unknown", "preparing"] as const) expect(studyContinuation(context({ selectedUnitId: "u1", material: { kind: "availability", state, job_id: null } })).kind).toBe(state);
    expect(studyContinuation(context({ selectedUnitId: "u1" })).kind).toBe("unavailable");
  });
  it("opens only matching existing material and does not demand permission to generate for reading", () => {
    expect(studyContinuation(context({ selectedUnitId: "u1", material, paused: true, allowedActions: {} })).kind).toBe("open");
    expect(studyContinuation(context({ selectedUnitId: "u1", material: { ...material, unit_id: "other" } })).kind).toBe("unavailable");
    expect(studyContinuation(context({ selectedUnitId: "u1", material: { ...material, plan_revision_id: "old-plan" } })).kind).toBe("unavailable");
  });
  it("continues the saved reading point only within its actual material version", () => {
    const saved = { ...cursor, unit_id: "u1", content_version_id: "fixture-version", block_id: "fixture-block" };
    expect(studyContinuation(context({ cursor: saved, material })).kind).toBe("continue");
    expect(studyContinuation(context({ cursor: saved, material: { ...material, content_version_id: "new-version" } })).kind).toBe("open");
    expect(studyContinuation(context({ cursor: saved, material: { ...material, blocks: [] } })).kind).toBe("open");
    expect(saved.block_id).toBe("fixture-block");
  });
  it("keeps the already-restored attempt rather than using the first lesson", () => {
    expect(studyContinuation(context({ attemptId: "fixture-attempt", cursor: { ...cursor, attempt_id: "fixture-attempt", item_id: "question-2" } })).kind).toBe("continue");
  });
  it("does not present a known attempt from another plan as the current continuation", () => {
    expect(studyContinuation(context({ attemptId: "old-attempt", attemptPlanRevisionId: "old-plan" })).kind).toBe("historical");
    expect(studyContinuation(context({ attemptId: "fixture-attempt", attemptPlanRevisionId: planFixture.id })).kind).toBe("continue");
    // Missing provenance does not fabricate a different plan or replace the attempt.
    expect(studyContinuation(context({ attemptId: "fixture-attempt", attemptPlanRevisionId: null })).kind).toBe("continue");
  });
  it("does not silently replace historical or missing selected context with the first unit", () => {
    expect(studyContinuation(context({ cursor: { ...cursor, plan_revision_id: "old-plan", unit_id: "u1" } })).kind).toBe("historical");
    expect(studyContinuation(context({ selectedUnitId: "removed-unit" })).kind).toBe("unavailable");
    expect(studyContinuation(context({ cursor: { ...cursor, unit_id: "u1" } })).kind).toBe("unavailable");
  });
});
