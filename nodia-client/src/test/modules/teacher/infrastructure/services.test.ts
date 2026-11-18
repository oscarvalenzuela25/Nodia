import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeTeacherRequest, readTeacherReceipt, sendTeacher, type TeacherCommand } from "../../../../modules/teacher/infrastructure/services";

const mock = vi.hoisted(() => ({ request: vi.fn(), get: vi.fn(), post: vi.fn() }));
vi.mock("../../../../config/api", () => ({ mainInstance: mock }));
const session = "00000000-0000-4000-8000-000000000001";
const job = "00000000-0000-4000-8000-000000000002";
const create: TeacherCommand = { method: "POST", path: "sessions", body: { start_plan: true }, requestKey: "fixture-intent" };
beforeEach(() => { mock.request.mockReset(); mock.get.mockReset(); mock.post.mockReset(); });

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
  it("requires recovery responses for the exact key", async () => {
    const receipt = { request_key: job, operation: "create", session_id: session, http_status: 201, receipt: { session_id: session }, completed_at: "2026-11-18T00:00:00.000Z" };
    mock.get.mockResolvedValue({ data: receipt });
    await expect(readTeacherReceipt(session)).rejects.toThrow();
    mock.post.mockResolvedValueOnce({ data: { status: "closed", request_key: job } })
      .mockResolvedValueOnce({ data: { status: "saved", request: receipt } })
      .mockResolvedValueOnce({ data: { status: "closed", request_key: session } });
    await expect(closeTeacherRequest(session)).rejects.toThrow();
    await expect(closeTeacherRequest(session)).rejects.toThrow();
    await expect(closeTeacherRequest(session)).resolves.toEqual({ status: "closed", request_key: session });
    expect(mock.post).toHaveBeenLastCalledWith(`/teacher/requests/${session}/close`);
  });
});
