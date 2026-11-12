import { describe, expect, it } from "vitest";
import { sessionSummarySchema, sessionsSchema } from "../../../../modules/teacher/infrastructure/schemas";

const session = {
  id: "00000000-0000-4000-8000-000000000001",
  title: null,
  topic: "Synthetic learning topic",
  objective: "Synthetic objective",
  state: "active",
  revision: 1,
  updated_at: "2026-11-11T19:00:00.000Z",
};

describe("Teacher session job contract", () => {
  it("keeps My Plans readable after a contextual clarification becomes the latest job", () => {
    const latestJob = { job_id: "00000000-0000-4000-8000-000000000002", state: "ready", purpose: "contextual_reply" };
    expect(sessionSummarySchema.parse({ ...session, latest_job: latestJob }).latest_job).toEqual(latestJob);
    const page = sessionsSchema.parse({ data: [{ ...session, latest_job: latestJob }], meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 } });
    expect(page.data[0].latest_job?.purpose).toBe("contextual_reply");
  });

  it("preserves historical rows without a latest job and rejects an unknown purpose", () => {
    expect(sessionSummarySchema.parse(session).latest_job).toBeUndefined();
    expect(sessionSummarySchema.safeParse({ ...session, latest_job: { job_id: "job", state: "ready", purpose: "unsupported_purpose" } }).success).toBe(false);
  });
});
