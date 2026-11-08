import { describe, expect, it } from "vitest";
import { canPollJob, enabled, hasPreparingJob, nextAttemptId, readyJobResult, restoreAttempt, restoreJob, resultNotice, sameAnswer } from "../../../../modules/teacher/infrastructure/presentation";
import { attemptSchema, createSessionSchema } from "../../../../modules/teacher/infrastructure/schemas";

describe("Teacher presentation boundaries", () => {
  it("blocks definition generation only while a reported job is queued or running, not for historical unknowns", () => {
    const row = (state: string) => ({ job_id: "fixture-job", purpose: "plan_outline", state });
    expect(hasPreparingJob([])).toBe(false);
    for (const state of ["queued", "running"]) expect(hasPreparingJob([row("unknown"), row(state)])).toBe(true);
    for (const state of ["ready", "failed_known", "unknown", "cancelled_before_dispatch", "blocked_paused"])
      expect(hasPreparingJob([row(state)])).toBe(false);
  });
  it("restores the Server's latest job instead of a historical unknown after reload", () => {
    const historical = [{ job_id: "old-packet", state: "unknown", purpose: "learning_packet" }];
    expect(restoreJob({ latest_job_id: "replacement-ready", active_jobs: historical })).toEqual({ jobId: "replacement-ready", followResult: false });
    expect(restoreJob({ latest_job_id: "new-unknown", active_jobs: historical })).toEqual({ jobId: "new-unknown", followResult: false });
    expect(restoreJob({ latest_job_id: "current-running", active_jobs: [{ job_id: "current-running", state: "running", purpose: "learning_packet" }, ...historical] })).toEqual({ jobId: "current-running", followResult: true });
    expect(restoreJob({ latest_job_id: null, active_jobs: historical })).toEqual({ jobId: null, followResult: false });
    expect(restoreJob({ active_jobs: historical })).toEqual({ jobId: "old-packet", followResult: false });
    expect(restoreJob({ active_jobs: [] })).toEqual({ jobId: null, followResult: false });
  });
  it("does not refocus an already-ready result over the saved cursor, and ignores stale job callbacks", () => {
    const ready = { job_id: "current", state: "ready" as const, result_ref: { attempt_id: "new-attempt" } };
    const restored = restoreJob({ latest_job_id: "current", active_jobs: [] });
    expect(readyJobResult(ready, restored)).toBeNull();
    const following = { jobId: "current", followResult: true };
    expect(readyJobResult(ready, following)).toEqual({ attempt_id: "new-attempt" });
    expect(readyJobResult({ ...ready, state: "running" }, following)).toBeNull();
    expect(readyJobResult({ ...ready, job_id: "older" }, following)).toBeNull();
  });
  it("restores the exact active cursor and never reuses an old question in a new variant", () => {
    expect(restoreAttempt({ attempt_id: "practice", item_id: "question2" }, [{ attempt_id: "final" }, { attempt_id: "practice" }])).toEqual({ attemptId: "practice", questionId: "question2" });
    expect(restoreAttempt({ attempt_id: "old-final", item_id: "old-question", updated_at: "2026-11-01T10:00:00Z" }, [{ attempt_id: "new-variant", created_at: "2026-11-01T10:01:00Z" }])).toEqual({ attemptId: "new-variant", questionId: null });
    expect(restoreAttempt({ attempt_id: "graded-final", item_id: "review", updated_at: "2026-11-01T10:01:00Z" }, [{ attempt_id: "old-practice", created_at: "2026-11-01T10:00:00Z" }])).toEqual({ attemptId: "graded-final", questionId: "review" });
    expect(restoreAttempt({ attempt_id: "graded", item_id: "review-question" }, [])).toEqual({ attemptId: "graded", questionId: "review-question" });
  });
  it("preserves the current question for feedback but opens a genuinely new assessment", () => {
    expect(nextAttemptId({ attempt_id: "practice" }, "practice")).toBeNull();
    expect(nextAttemptId({ attempt_id: "final" }, "practice")).toBe("final");
    expect(nextAttemptId({ attempt_id: "initial" }, null)).toBe("initial");
    expect(nextAttemptId({ proposal_revision_id: "outline" }, "practice")).toBeNull();
    expect(nextAttemptId(null, "practice")).toBeNull();
  });
  it("polls only active jobs while visible and unpaused", () => {
    expect(canPollJob("queued", true, false)).toBe(true);
    expect(canPollJob("running", false, false)).toBe(false);
    expect(canPollJob("running", true, true)).toBe(false);
    for (const state of ["unknown", "ready", "failed_known", "blocked_paused"]) expect(canPollJob(state, true, false)).toBe(false);
  });
  it("uses server actions and keeps missing authority closed", () => {
    expect(enabled({}, "start_final")).toBe(false);
    expect(enabled({ start_final: { enabled: false, reason_code: "prerequisite_not_verified" } }, "start_final")).toBe(false);
    expect(enabled({ start_final: { enabled: true, reason_code: null } }, "start_final")).toBe(true);
  });
  it("keeps empty, explicit unknown, and unchanged answers distinct", () => {
    expect(sameAnswer(null, { kind: "dont_know" })).toBe(false);
    expect(sameAnswer({ kind: "completion", text: "0" }, { kind: "completion", text: "" })).toBe(false);
    expect(sameAnswer({ kind: "single_choice", option_id: "0" }, { kind: "single_choice", option_id: "0" })).toBe(true);
  });
  it("does not turn a pending grade into failure or use rounded percentages to pass", () => {
    const base = { attempt_id: "a", session_id: "s", scope: "section_final", state: "grading_pending", revision: 1, questions: [], allowed_actions: {}, result: "pending", percentage: null };
    expect(resultNotice(attemptSchema.parse(base))).toBe("pending");
    expect(resultNotice(attemptSchema.parse({ ...base, state: "graded", result: "not_passed", percentage: 89.6 }))).toBe("not_passed");
    expect(resultNotice(attemptSchema.parse({ ...base, state: "graded", result: "passed", percentage: 90 }))).toBe("passed");
    expect(resultNotice(attemptSchema.parse({ ...base, scope: "unit_practice", state: "graded", result: null }))).toBe("practice_complete");
  });
  it("can save a draft with unknown day count without inventing a schedule", () => {
    const input = { topic: " Redes ", objective: "Aprender DNS", explanation_language: "es", organization: "topics", day_count: null };
    expect(createSessionSchema.parse(input).topic).toBe("Redes");
    expect(createSessionSchema.safeParse({ ...input, organization: "days" }).success).toBe(true);
    expect(createSessionSchema.safeParse({ ...input, organization: "days", day_count: 0 }).success).toBe(false);
    expect(createSessionSchema.safeParse({ ...input, organization: "days", day_count: 12 }).success).toBe(true);
  });
});
