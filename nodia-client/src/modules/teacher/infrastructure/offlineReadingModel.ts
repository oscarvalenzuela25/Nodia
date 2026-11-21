import { isStudyRecord, offlineStudyUuid } from "./offlineStudyIdentity";

export type OfflineReadingContext = {
  sectionId: string;
  cursorRevision: number;
  savedBlockId?: string | null;
};

export type OfflineReadingPoint = {
  planRevisionId: string;
  sectionId: string;
  unitId: string;
  contentVersionId: string;
  blockId: string;
};

export type OfflineReadingCursor = { revision: number; point: OfflineReadingPoint | null };
export type OfflineReadingIssue = "revision" | "unavailable" | "stale";

export type OfflineReadingIntent = {
  studyId: string;
  copyId: string;
  requestKey: string;
  expectedCursorRevision: number;
  expiresAt: number;
  point: OfflineReadingPoint;
  state: "pending" | "uncertain" | "conflict" | "rejected";
  issue?: OfflineReadingIssue;
  serverCursor?: OfflineReadingCursor;
};

export type OfflineReadingProgress = {
  intent: OfflineReadingIntent | null;
  confirmed: OfflineReadingCursor | null;
};

export type OfflineReadingOutcome =
  | { kind: "applied"; cursor: OfflineReadingCursor }
  | { kind: "conflict" | "rejected"; issue: OfflineReadingIssue; serverCursor?: OfflineReadingCursor };

export const maxCursorRevision = 2_147_483_647;
export const emptyOfflineReadingProgress: OfflineReadingProgress = { intent: null, confirmed: null };

export function sameOfflineReadingPoint(a: OfflineReadingPoint | null, b: OfflineReadingPoint | null): boolean {
  if (!a || !b) return a === b;
  return a.planRevisionId === b.planRevisionId && a.sectionId === b.sectionId && a.unitId === b.unitId &&
    a.contentVersionId === b.contentVersionId && a.blockId === b.blockId;
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && offlineStudyUuid.test(value);
}

function validRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= maxCursorRevision;
}

function validBlock(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 64;
}

export function validOfflineReadingContext(value: unknown): value is OfflineReadingContext {
  return isStudyRecord(value) && validUuid(value.sectionId) && validRevision(value.cursorRevision) &&
    (value.savedBlockId == null || validBlock(value.savedBlockId));
}

function validPoint(value: unknown): value is OfflineReadingPoint {
  return isStudyRecord(value) && validUuid(value.planRevisionId) && validUuid(value.sectionId) &&
    validUuid(value.unitId) && validUuid(value.contentVersionId) && validBlock(value.blockId);
}

export function validOfflineReadingCursor(value: unknown): value is OfflineReadingCursor {
  return isStudyRecord(value) && validRevision(value.revision) && (value.point === null || validPoint(value.point));
}

function validIntent(value: unknown, studyId: string): value is OfflineReadingIntent {
  if (!isStudyRecord(value) || value.studyId !== studyId || !validUuid(value.requestKey) ||
    !validRevision(value.expectedCursorRevision) || value.expectedCursorRevision === maxCursorRevision ||
    typeof value.expiresAt !== "number" || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= 0 ||
    !validPoint(value.point) || value.copyId !== `${studyId}:${value.point.unitId}`.toLowerCase()) return false;
  if (value.state === "pending" || value.state === "uncertain") {
    return value.issue === undefined && value.serverCursor === undefined;
  }
  return (value.state === "conflict" || value.state === "rejected") &&
    (value.issue === "revision" || value.issue === "unavailable" || value.issue === "stale") &&
    (value.serverCursor === undefined || validOfflineReadingCursor(value.serverCursor));
}

export function validOfflineReadingBook(value: unknown, limit: number): value is Record<string, OfflineReadingProgress> {
  if (!isStudyRecord(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= limit && entries.every(([studyId, progress]) => validUuid(studyId) &&
    isStudyRecord(progress) && (progress.confirmed === null || validOfflineReadingCursor(progress.confirmed)) &&
    (progress.intent === null || validIntent(progress.intent, studyId)));
}

export function newerOfflineReadingCursor(previous: OfflineReadingCursor | null, next: OfflineReadingCursor): OfflineReadingCursor {
  return previous && previous.revision >= next.revision ? previous : next;
}
