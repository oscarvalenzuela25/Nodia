import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { refreshTeacherQueries } from "../../../../modules/teacher/infrastructure/refresh";

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });

async function studyCache() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  cleanups.push(() => client.clear());
  const reads: string[] = [];
  const actor = ["teacher", "user", 1];
  const paths = ["sessions", "sessions/s", "sessions/s/messages", "sessions/s/units/u", "sessions/s/attempts/a", "sessions/s/attempts/a/questions/q",
    "sessions/s/learning", "sessions/s/enrichment", "sessions/s/enrichment/concepts/c", "sessions/other", "sessions/other/learning",
    "connections", "connections/1/eligibility", "connections/2/eligibility"];
  for (const path of paths) {
    const queryKey = [...actor, path, undefined];
    client.setQueryData(queryKey, { saved: true });
    const observer = new QueryObserver(client, { queryKey, queryFn: async () => { reads.push(path); return { saved: true }; } });
    cleanups.push(observer.subscribe(() => {}));
  }
  const jobKey = [...actor, "jobs", "ready"];
  client.setQueryData(jobKey, { state: "ready" });
  const job = new QueryObserver(client, { queryKey: jobKey, queryFn: async () => { reads.push("ready-job"); return { state: "ready" }; } });
  cleanups.push(job.subscribe(() => {}));
  const otherActor = [...actor.slice(0, 2), 2, "sessions/s"];
  client.setQueryData(otherActor, {});
  const observer = new QueryObserver(client, { queryKey: otherActor, queryFn: async () => { reads.push("other-actor"); return {}; } });
  cleanups.push(observer.subscribe(() => {}));
  return { client, actor, reads };
}

describe("Teacher study query refresh", () => {
  it("refreshes the cursor authority without rereading the hidden reader, quiz or terminal job", async () => {
    const { client, actor, reads } = await studyCache();
    await refreshTeacherQueries(client, actor, "sessions/s/cursor");
    expect(reads).toEqual(["sessions/s"]);
  });
  it("refreshes setup draft authority without rereading catalogs, messages, study data or other actors", async () => {
    const { client, actor, reads } = await studyCache();
    await refreshTeacherQueries(client, actor, "sessions/s/setup-draft");
    expect(reads).toEqual(["sessions/s"]);
  });
  it("refreshes draft revisions on the attempt and question only", async () => {
    const { client, actor, reads } = await studyCache();
    await refreshTeacherQueries(client, actor, "sessions/s/attempts/a/responses");
    expect(reads).toEqual(["sessions/s/attempts/a", "sessions/s/attempts/a/questions/q"]);
  });
  it("refreshes submission and feedback authorities without unrelated resources or another actor", async () => {
    const { client, actor, reads } = await studyCache();
    await refreshTeacherQueries(client, actor, "sessions/s/attempts/a/responses/q/submit");
    expect(reads).toEqual(["sessions/s", "sessions/s/attempts/a", "sessions/s/attempts/a/questions/q",
      "sessions/s/learning", "sessions/s/enrichment", "sessions/s/enrichment/concepts/c"]);
    reads.length = 0;
    await refreshTeacherQueries(client, actor, "sessions/s/attempts/a");
    expect(reads).toEqual(["sessions", "sessions/s", "sessions/s/units/u", "sessions/s/attempts/a", "sessions/s/attempts/a/questions/q",
      "sessions/s/learning", "sessions/s/enrichment", "sessions/s/enrichment/concepts/c"]);
  });
  it.each(["sessions/s/plan-proposals", "sessions/s/learning/diagnostic-mappings", "sessions/s/enrichment/commands", "sessions/s/pause", "sessions", "jobs/job/continue-before-dispatch"])(
    "refreshes study authorities without observing providers again after %s", async command => {
      const { client, actor, reads } = await studyCache();
      await refreshTeacherQueries(client, actor, command);
      expect(reads).toContain("sessions");
      expect(reads).toContain("sessions/s");
      expect(reads).toContain("sessions/s/units/u");
      expect(reads).toContain("sessions/s/learning");
      expect(reads).toContain("sessions/s/enrichment");
      expect(reads).toContain("sessions/s/attempts/a");
      expect(reads).toContain("sessions/s/attempts/a/questions/q");
      expect(reads).toContain("ready-job");
      expect(reads).not.toContain("connections");
      expect(reads).not.toContain("connections/1/eligibility");
      expect(reads).not.toContain("connections/2/eligibility");
      expect(reads).not.toContain("other-actor");
    },
  );
  it("refreshes terminal attempt progress and derived evidence while leaving other sessions and providers alone", async () => {
    const { client, actor, reads } = await studyCache();
    await refreshTeacherQueries(client, actor, "sessions/s/attempts/a/submit");
    expect(reads).toEqual(["sessions", "sessions/s", "sessions/s/units/u", "sessions/s/attempts/a", "sessions/s/attempts/a/questions/q",
      "sessions/s/learning", "sessions/s/enrichment", "sessions/s/enrichment/concepts/c"]);
  });
  it.each(["sessions/s", undefined])("retains provider revalidation for session selection edits or explicit completion refresh (%s)", async command => {
    const { client, actor, reads } = await studyCache();
    await refreshTeacherQueries(client, actor, command);
    expect(reads).toContain("connections");
    expect(reads).toContain("connections/1/eligibility");
    expect(reads).toContain("connections/2/eligibility");
    expect(reads).toContain("sessions/s/learning");
    expect(reads).not.toContain("other-actor");
  });
});
