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
  const paths = ["sessions/s", "sessions/s/messages", "sessions/s/units/u", "sessions/s/attempts/a", "sessions/s/attempts/a/questions/q", "sessions/other"];
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
    expect(reads).toEqual(["sessions/s", "sessions/s/attempts/a", "sessions/s/attempts/a/questions/q"]);
    reads.length = 0;
    await refreshTeacherQueries(client, actor, "sessions/s/attempts/a");
    expect(reads).toEqual(["sessions/s", "sessions/s/attempts/a", "sessions/s/attempts/a/questions/q"]);
  });
  it("retains complete invalidation for other commands and explicit recovery refresh", async () => {
    const { client, actor, reads } = await studyCache();
    await refreshTeacherQueries(client, actor, "sessions/s/pause");
    expect(reads).toHaveLength(7);
    expect(reads).not.toContain("other-actor");
  });
});
