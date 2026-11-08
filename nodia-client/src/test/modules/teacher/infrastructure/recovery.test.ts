import { afterEach, describe, expect, it } from "vitest";
import { forgetRequest, pendingRequest, rememberRequest } from "../../../../modules/teacher/infrastructure/recovery";
const command = { method: "POST" as const, path: "sessions", requestKey: "11111111-1111-4111-8111-111111111111", body: { objective: "private learner text" } };
afterEach(() => forgetRequest());
describe("Teacher opaque request recovery", () => {
  it("survives a reload through tab metadata without persisting payload or allowing replay", () => {
    rememberRequest("actor:1", command);
    expect(window.sessionStorage.getItem("teacher:pending-request:v1")).not.toContain("private learner text");
    expect(pendingRequest("actor:1")).toEqual({ ...command, body: {} });
    forgetRequest();
    expect(pendingRequest("actor:1")).toBeNull();
  });
  it("does not restore another actor's request and rejects malformed metadata", () => {
    rememberRequest("actor:1", command);
    expect(pendingRequest("other:2")).toBeNull();
    window.sessionStorage.setItem("teacher:pending-request:v1", JSON.stringify({ ...command, actorScope: "actor:1" }));
    expect(pendingRequest("actor:1")).toBeNull();
    window.sessionStorage.setItem("teacher:pending-request:v1", "{");
    expect(pendingRequest("actor:1")).toBeNull();
  });
});
