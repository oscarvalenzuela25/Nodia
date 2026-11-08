import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendTeacher, type TeacherCommand } from "../../../../modules/teacher/infrastructure/services";

const mock = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../../../config/api", () => ({ mainInstance: { request: mock.request } }));
const session = "00000000-0000-4000-8000-000000000001";
const job = "00000000-0000-4000-8000-000000000002";
const create: TeacherCommand = { method: "POST", path: "sessions", body: { start_plan: true }, requestKey: "fixture-intent" };
beforeEach(() => mock.request.mockReset());

describe("Teacher command response contracts", () => {
  it("rejects a session-only response when creation promised a queued plan instead of announcing success", async () => {
    mock.request.mockResolvedValue({ data: { session_id: session, revision: 1 } });
    await expect(sendTeacher(create)).rejects.toThrow();
    expect(mock.request).toHaveBeenCalledOnce();
  });
  it("accepts an exact queued acknowledgement and retains the legacy draft creation contract", async () => {
    mock.request.mockResolvedValueOnce({ data: { kind: "job", state: "queued", session_id: session, job_id: job, revision: 1 } });
    await expect(sendTeacher(create)).resolves.toMatchObject({ session_id: session, job_id: job });
    mock.request.mockResolvedValueOnce({ data: { session_id: session, revision: 1 } });
    await expect(sendTeacher({ ...create, body: {} })).resolves.toMatchObject({ session_id: session });
  });
  it("does not treat incomplete or invalid draft revisions as a confirmed save", async () => {
    const draft: TeacherCommand = { ...create, method: "PATCH", path: `sessions/${session}/setup-draft`, body: {} };
    mock.request.mockResolvedValueOnce({ data: { session_id: session } });
    await expect(sendTeacher(draft)).rejects.toThrow();
    mock.request.mockResolvedValueOnce({ data: { session_id: session, setup_draft_text: "", setup_draft_revision: -1 } });
    await expect(sendTeacher(draft)).rejects.toThrow();
    mock.request.mockResolvedValueOnce({ data: { session_id: session, setup_draft_text: "", setup_draft_revision: 0 } });
    await expect(sendTeacher(draft)).resolves.toMatchObject({ setup_draft_text: "", setup_draft_revision: 0 });
  });
});
