import {
  claimOfflineReadingIntent, listOfflineReadingIntents, settleOfflineReadingIntent,
  type OfflineReadingCursor, type OfflineReadingIntent,
} from "./offlineStudy";
import { maxCursorRevision, sameOfflineReadingPoint } from "./offlineReadingModel";
import {
  clearOfflineStudyGrant, isStudyRecord, offlineStudyGrantSnapshot, offlineStudyUuid,
  readOfflineStudyAccount, sameOfflineStudyScope,
} from "./offlineStudyIdentity";
import { hasUnexpiredAccessToken, requestOfflineTeacher } from "./offlineTeacherTransport";

type Account = NonNullable<ReturnType<typeof readOfflineStudyAccount>>;

function revision(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= maxCursorRevision;
}

function id(value: unknown): value is string {
  return typeof value === "string" && offlineStudyUuid.test(value);
}

function parseServerCursor(data: unknown, studyId: string): OfflineReadingCursor | undefined {
  if (!isStudyRecord(data) || data.id !== studyId || !isStudyRecord(data.cursor)) return;
  const { revision: cursorRevision, phase, plan_revision_id, section_id, unit_id, content_version_id, block_id } = data.cursor;
  if (!revision(cursorRevision)) return;
  const point = phase === "theory" && id(plan_revision_id) && id(section_id) && id(unit_id) && id(content_version_id) &&
    typeof block_id === "string" && block_id.length > 0 && block_id.length <= 64
    ? { planRevisionId: plan_revision_id, sectionId: section_id, unitId: unit_id, contentVersionId: content_version_id, blockId: block_id }
    : null;
  return { revision: cursorRevision, point };
}

function acknowledged(data: unknown, intent: OfflineReadingIntent): OfflineReadingCursor | undefined {
  if (!isStudyRecord(data) || data.session_id !== intent.studyId || !revision(data.cursor_revision) ||
    data.cursor_revision !== intent.expectedCursorRevision + 1) return;
  return { revision: data.cursor_revision, point: intent.point };
}

function responseCode(data: unknown): string | undefined {
  return isStudyRecord(data) && typeof data.code === "string" ? data.code : undefined;
}

type SyncResult = "applied" | "handled" | "stop";

async function syncIntent(intent: OfflineReadingIntent, account: Account, current: () => boolean): Promise<SyncResult> {
  const active = await claimOfflineReadingIntent(intent.studyId, intent.requestKey);
  if (!active || !current()) return "handled";
  const { requestKey, studyId, point } = active;
  const receipt = await requestOfflineTeacher(`requests/${requestKey}`, account.token);
  if (!current()) return "stop";
  if (receipt.status === 200 && isStudyRecord(receipt.data) && receipt.data.request_key === requestKey &&
    receipt.data.operation === "reading_point" && receipt.data.session_id === studyId && receipt.data.http_status === 200) {
    const cursor = acknowledged(receipt.data.receipt, active);
    if (cursor) await settleOfflineReadingIntent(studyId, requestKey, { kind: "applied", cursor });
    return cursor ? "applied" : "stop";
  }
  if (receipt.status === 403) clearOfflineStudyGrant(account.scope);
  if (receipt.status === 410 && responseCode(receipt.data) === "request_closed") {
    await settleOfflineReadingIntent(studyId, requestKey, { kind: "rejected", issue: "unavailable" });
    return "handled";
  }
  if (receipt.status !== 404 || responseCode(receipt.data) !== "not_found") return "stop";
  const dispatchable = await claimOfflineReadingIntent(studyId, requestKey);
  if (!dispatchable || !current()) return "handled";

  const response = await requestOfflineTeacher(`sessions/${studyId}/reading-point`, account.token, {
    write: {
      key: requestKey,
      body: { expected_cursor_revision: active.expectedCursorRevision, plan_revision_id: point.planRevisionId,
        section_id: point.sectionId, unit_id: point.unitId, content_version_id: point.contentVersionId, block_id: point.blockId },
    },
  });
  if (!current()) return "stop";
  if (response.status === 200) {
    const cursor = acknowledged(response.data, active);
    if (cursor) await settleOfflineReadingIntent(studyId, requestKey, { kind: "applied", cursor });
    return cursor ? "applied" : "stop";
  }
  if (response.status === 403) { clearOfflineStudyGrant(account.scope); return "stop"; }
  const code = responseCode(response.data);
  if (response.status === 409 && code === "revision_conflict") {
    const refreshed = await requestOfflineTeacher(`sessions/${studyId}`, account.token);
    if (!current()) return "stop";
    if (refreshed.status === 403) { clearOfflineStudyGrant(account.scope); return "stop"; }
    const cursor = refreshed.status === 200 ? parseServerCursor(refreshed.data, studyId) : undefined;
    if (cursor && cursor.revision > active.expectedCursorRevision) {
      const converged = sameOfflineReadingPoint(cursor.point, point);
      await settleOfflineReadingIntent(studyId, requestKey, converged
        ? { kind: "applied", cursor } : { kind: "conflict", issue: "revision", serverCursor: cursor });
      return converged ? "applied" : "handled";
    }
    return "stop";
  }
  if ((response.status === 404 && code === "not_found") || response.status === 400 || code === "reading_material_outdated" ||
    code === "reading_point_unavailable" || code === "session_paused" || code === "session_archived") {
    await settleOfflineReadingIntent(studyId, requestKey, {
      kind: "rejected",
      issue: response.status === 404 || response.status === 400 || code === "reading_material_outdated" ? "stale" : "unavailable",
    });
    return "handled";
  }
  // Keep the exact request and reconcile its receipt on the next connection or retry.
  return "stop";
}

let inFlight: Promise<string[]> | undefined;

export function syncOfflineReadingProgress(): Promise<string[]> {
  if (inFlight) return inFlight;
  const account = readOfflineStudyAccount();
  const { raw, grant } = offlineStudyGrantSnapshot();
  if (!account || !grant || navigator.onLine === false || !hasUnexpiredAccessToken(account.token) ||
    !sameOfflineStudyScope(account.scope, grant)) return Promise.resolve([]);
  const current = () => navigator.onLine !== false && offlineStudyGrantSnapshot().raw === raw &&
    sameOfflineStudyScope(readOfflineStudyAccount()?.scope ?? null, account.scope);

  const flush = async () => {
    const applied: string[] = [];
    for (const intent of await listOfflineReadingIntents()) {
      if (!current()) break;
      if (intent.state !== "pending" && intent.state !== "uncertain") continue;
      const result = await syncIntent(intent, account, current).catch((): SyncResult => "stop");
      if (result === "stop") break;
      if (result === "applied") applied.push(intent.studyId);
    }
    return applied;
  };

  inFlight = (navigator.locks
    ? navigator.locks.request(`nodia-teacher-reading:${grant.grantId}`, { ifAvailable: true }, lock => lock ? flush() : [])
    : flush()).catch(() => []).finally(() => { inFlight = undefined; });
  return inFlight;
}
