import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncOfflineReadingProgress } from "../../../../modules/teacher/infrastructure/syncOfflineReading";
import type { OfflineReadingIntent } from "../../../../modules/teacher/infrastructure/offlineStudy";

const mocks = vi.hoisted(() => ({
  claim: vi.fn(), list: vi.fn(), settle: vi.fn(), request: vi.fn(), revoke: vi.fn(),
}));
const scope = { ownerId: "41", sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const persistentGrant = { raw: "grant-marker", grant: { ...scope, grantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" } };

vi.mock("../../../../modules/teacher/infrastructure/offlineStudy", () => ({
  claimOfflineReadingIntent: mocks.claim, listOfflineReadingIntents: mocks.list, settleOfflineReadingIntent: mocks.settle,
}));
vi.mock("../../../../modules/teacher/infrastructure/offlineStudyIdentity", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../../modules/teacher/infrastructure/offlineStudyIdentity")>(),
  clearOfflineStudyGrant: mocks.revoke,
  offlineStudyGrantSnapshot: () => persistentGrant,
  readOfflineStudyAccount: () => ({ scope, token: "synthetic-access-token" }),
}));
vi.mock("../../../../modules/teacher/infrastructure/offlineTeacherTransport", () => ({
  requestOfflineTeacher: mocks.request, hasUnexpiredAccessToken: () => true,
}));

const studyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const point = {
  planRevisionId: "11111111-1111-4111-8111-111111111111",
  sectionId: "22222222-2222-4222-8222-222222222222",
  unitId: "33333333-3333-4333-8333-333333333333",
  contentVersionId: "44444444-4444-4444-8444-444444444444",
  blockId: "theory",
};
const intent: OfflineReadingIntent = {
  studyId, copyId: `${studyId}:${point.unitId}`, requestKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  expectedCursorRevision: 5, point, state: "uncertain", expiresAt: Date.now() + 60_000,
};
const missingReceipt = { status: 404, data: { code: "not_found" } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue([intent]);
  mocks.claim.mockResolvedValue(intent);
  mocks.settle.mockResolvedValue(true);
});

describe("offline reading synchronization", () => {
  it("recovers a committed write from its original receipt after losing the response", async () => {
    mocks.request.mockResolvedValueOnce(missingReceipt).mockRejectedValueOnce(new TypeError("response lost"));
    await expect(syncOfflineReadingProgress()).resolves.toEqual([]);
    expect(mocks.settle).not.toHaveBeenCalled();
    expect(mocks.request.mock.calls[1][2].write.key).toBe(intent.requestKey);

    mocks.request.mockResolvedValueOnce({ status: 200, data: {
      request_key: intent.requestKey, operation: "reading_point", session_id: studyId, http_status: 200,
      receipt: { session_id: studyId, cursor_revision: 6 },
    } });
    await expect(syncOfflineReadingProgress()).resolves.toEqual([studyId]);
    expect(mocks.request).toHaveBeenCalledTimes(3);
    expect(mocks.settle).toHaveBeenCalledExactlyOnceWith(studyId, intent.requestKey, { kind: "applied", cursor: { revision: 6, point } });
  });

  it.each(["theory", "example"])("uses the server cursor without rebasing a concurrent %s point", async remoteBlock => {
    mocks.request.mockResolvedValueOnce(missingReceipt)
      .mockResolvedValueOnce({ status: 409, data: { code: "revision_conflict" } })
      .mockResolvedValueOnce({ status: 200, data: { id: studyId, cursor: {
        revision: 7, phase: "theory", plan_revision_id: point.planRevisionId, section_id: point.sectionId,
        unit_id: point.unitId, content_version_id: point.contentVersionId, block_id: remoteBlock,
      } } });
    const cursor = { revision: 7, point: { ...point, blockId: remoteBlock } };
    await expect(syncOfflineReadingProgress()).resolves.toEqual(remoteBlock === point.blockId ? [studyId] : []);
    expect(mocks.request).toHaveBeenCalledTimes(3);
    expect(mocks.settle).toHaveBeenCalledExactlyOnceWith(studyId, intent.requestKey,
      remoteBlock === point.blockId ? { kind: "applied", cursor } : { kind: "conflict", issue: "revision", serverCursor: cursor });
  });

  it("stops when access to the receipt is revoked", async () => {
    mocks.request.mockResolvedValueOnce({ status: 403, data: null });
    await syncOfflineReadingProgress();
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith(`requests/${intent.requestKey}`, "synthetic-access-token");
    expect(mocks.revoke).toHaveBeenCalledExactlyOnceWith(scope);
    expect(mocks.settle).not.toHaveBeenCalled();
  });

  it("does not dispatch if the source copy disappears during receipt lookup", async () => {
    mocks.claim.mockResolvedValueOnce(intent).mockResolvedValueOnce(null);
    mocks.request.mockResolvedValueOnce(missingReceipt);
    await expect(syncOfflineReadingProgress()).resolves.toEqual([]);
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith(`requests/${intent.requestKey}`, "synthetic-access-token");
    expect(mocks.settle).not.toHaveBeenCalled();
  });

  it("keeps the original intent when a conflict read returns the old revision", async () => {
    mocks.request.mockResolvedValueOnce(missingReceipt)
      .mockResolvedValueOnce({ status: 409, data: { code: "revision_conflict" } })
      .mockResolvedValueOnce({ status: 200, data: { id: studyId, cursor: { revision: 5 } } });
    await expect(syncOfflineReadingProgress()).resolves.toEqual([]);
    expect(mocks.settle).not.toHaveBeenCalled();
  });
});
