import { afterEach, describe, expect, it } from "vitest";
import { clearOfflineStudyGrant, listOfflineStudy, makeOfflineStudyCopy, offlineStudyScope, openOfflineStudy,
  readOfflineStudyAccount, saveOfflineStudy, subscribeOfflineStudyChanges } from "../../../../modules/teacher/infrastructure/offlineStudy";
import { offlineStudyGrantKey } from "../../../../modules/teacher/infrastructure/offlineStudyIdentity";
import { newerOfflineReadingCursor, sameOfflineReadingPoint, validOfflineReadingBook,
  type OfflineReadingIntent } from "../../../../modules/teacher/infrastructure/offlineReadingModel";

const authSession = "c2fda28e-bca1-4678-bb76-359e97042ef0";
const anotherSession = "2761e8b5-2bc7-4cf1-9233-97204e0fb2cf";
const material = {
  studyId: "11111111-1111-4111-8111-111111111111",
  unitId: "22222222-2222-4222-8222-222222222222",
  planRevisionId: "33333333-3333-4333-8333-333333333333",
  contentVersionId: "44444444-4444-4444-8444-444444444444",
  title: "Una copia de estudio",
  blocks: [{ id: "idea", title: "Concepto", body_markdown: "El contenido autorizado." }],
};
const copyId = `${material.studyId}:${material.unitId}`;

function token(sub: string, sid: string, claims: Record<string, unknown> = {}) {
  const payload = btoa(JSON.stringify({ sub, sid, token_use: "access", exp: 10, ...claims }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${payload}.fixture`;
}

function saveAccount(ownerId: string, sid = authSession, currentToken = token(ownerId, sid)) {
  localStorage.setItem("authStore", JSON.stringify({ state: { user: { id: ownerId }, token: currentToken }, version: 1 }));
}

function saveGrant(ownerId: string, sessionId = authSession) {
  localStorage.setItem(offlineStudyGrantKey, JSON.stringify({ ownerId, sessionId, grantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }));
}

afterEach(() => localStorage.clear());

describe("teacher offline account matching", () => {
  it("keeps the same scope across ordinary token rotation and rejects identity or token type substitution", () => {
    const initial = offlineStudyScope(token("17", authSession), "17");
    expect(initial).toEqual({ ownerId: "17", sessionId: authSession });
    expect(offlineStudyScope(token("17", authSession, { exp: 20, jti: "renewed" }), "17")).toEqual(initial);
    expect(offlineStudyScope(token("17", anotherSession), "17")).not.toEqual(initial);
    expect(offlineStudyScope(token("17", authSession), "18")).toBeNull();
    expect(offlineStudyScope(token("17", authSession, { token_use: "refresh" }), "17")).toBeNull();
    expect(offlineStudyScope(token("17", "unrecognized"), "17")).toBeNull();
    expect(offlineStudyScope("historical.invalid", "17")).toBeNull();
  });

  it("does not expose another account's grant even with its exact copy id", async () => {
    saveGrant("17");
    saveAccount("18");
    await expect(listOfflineStudy()).resolves.toEqual([]);
    await expect(openOfflineStudy(copyId)).resolves.toBeNull();
    saveAccount("17", anotherSession);
    await expect(openOfflineStudy(copyId)).resolves.toBeNull();
  });

  it("invalidates the offline grant synchronously even while the old session hint is still present", async () => {
    saveAccount("17");
    saveGrant("17");
    const prior = localStorage.getItem(offlineStudyGrantKey);
    let updated = 0;
    let externalUpdates = 0;
    const stop = subscribeOfflineStudyChanges(() => { updated++; });
    const stopExternal = subscribeOfflineStudyChanges(() => { externalUpdates++; }, false);
    clearOfflineStudyGrant();
    expect(updated).toBe(1);
    expect(externalUpdates).toBe(0);
    window.dispatchEvent(new StorageEvent("storage", { key: offlineStudyGrantKey }));
    expect(externalUpdates).toBe(1);
    expect(localStorage.getItem(offlineStudyGrantKey)).not.toBe(prior);
    expect(readOfflineStudyAccount()?.scope.ownerId).toBe("17");
    await expect(listOfflineStudy()).resolves.toEqual([]);
    await expect(openOfflineStudy(copyId)).resolves.toBeNull();
    stop();
    stopExternal();
  });

  it("leaves a newer account's grant untouched when an old scope receives a denial", () => {
    saveAccount("18", anotherSession);
    saveGrant("18", anotherSession);
    const prior = localStorage.getItem(offlineStudyGrantKey);
    clearOfflineStudyGrant({ ownerId: "17", sessionId: authSession });
    expect(localStorage.getItem(offlineStudyGrantKey)).toBe(prior);
  });
});

describe("teacher offline snapshot", () => {
  it("preserves a downloaded reading baseline without inventing one for an older copy", () => {
    const readingContext = { sectionId: "55555555-5555-4555-8555-555555555555", cursorRevision: 17, savedBlockId: "idea" };
    expect(makeOfflineStudyCopy(material, 1_000).readingContext).toBeUndefined();
    expect(makeOfflineStudyCopy({ ...material, readingContext }, 1_000).readingContext).toEqual(readingContext);
    expect(() => makeOfflineStudyCopy({ ...material, readingContext: { ...readingContext, cursorRevision: 0 } }, 1_000)).toThrow("invalid");
  });
  it("stores only the theory projection and an explicit expiration with stable unit identity", () => {
    const copy = makeOfflineStudyCopy({ ...material, interactions: ["private"], responses: ["private"],
      blocks: [{ ...material.blocks[0], answer: "private" }] }, 1_000);
    expect(copy).toEqual({ ...material, id: copyId, downloadedAt: 1_000, expiresAt: 86_401_000 });
  });

  it("rejects malformed material before writing anything", () => {
    expect(() => makeOfflineStudyCopy({ ...material, unitId: "not-a-uuid" }, 1_000)).toThrow("invalid");
    expect(() => makeOfflineStudyCopy({ ...material, blocks: [{ id: "bare" }] }, 1_000)).toThrow("invalid");
  });

  it("rejects an oversized copy and a stale authorized callback without publishing a grant", async () => {
    saveAccount("17");
    const scope = readOfflineStudyAccount()!.scope;
    await expect(saveOfflineStudy(scope, { ...material,
      blocks: [{ ...material.blocks[0], body_markdown: "á".repeat(140_000) }],
    }, () => true)).rejects.toMatchObject({ code: "too-large" });
    await expect(saveOfflineStudy(scope, material, () => false)).rejects.toMatchObject({ code: "stale" });
    expect(localStorage.getItem(offlineStudyGrantKey)).toBeNull();
  });
});

describe("teacher queued reading intent boundaries", () => {
  const point = { planRevisionId: material.planRevisionId, sectionId: "55555555-5555-4555-8555-555555555555",
    unitId: material.unitId, contentVersionId: material.contentVersionId, blockId: "idea" };
  const intent: OfflineReadingIntent = { studyId: material.studyId, copyId, requestKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    expectedCursorRevision: 17, point, state: "pending", expiresAt: 86_401_000 };
  const existing = { revision: 18, point };

  it("accepts a frozen conflict cursor and rejects attaching an unconfirmed server cursor to a dispatchable intent", () => {
    const book = (value: unknown) => ({ [material.studyId]: { intent: value, confirmed: null } });
    expect(validOfflineReadingBook(book(intent), 10)).toBe(true);
    expect(validOfflineReadingBook(book({ ...intent, serverCursor: existing }), 10)).toBe(false);
    expect(validOfflineReadingBook(book({ ...intent, state: "conflict", issue: "revision", serverCursor: existing }), 10)).toBe(true);
    expect(validOfflineReadingBook(book({ ...intent, studyId: material.unitId }), 10)).toBe(false);
    expect(validOfflineReadingBook(book({ ...intent, copyId: `${material.unitId}:${material.studyId}` }), 10)).toBe(false);
    expect(validOfflineReadingBook(book({ ...intent, expectedCursorRevision: 2_147_483_647 }), 10)).toBe(false);
  });

  it("keeps a later confirmed cursor and compares every versioned anchor", () => {
    expect(newerOfflineReadingCursor(existing, { revision: 17, point: null })).toBe(existing);
    expect(newerOfflineReadingCursor(existing, { revision: 18, point: null })).toBe(existing);
    expect(newerOfflineReadingCursor(existing, { revision: 19, point: null })).toEqual({ revision: 19, point: null });
    expect(sameOfflineReadingPoint(point, { ...point })).toBe(true);
    expect(sameOfflineReadingPoint(point, { ...point, contentVersionId: material.unitId })).toBe(false);
    expect(sameOfflineReadingPoint(point, { ...point, blockId: "another" })).toBe(false);
  });
});
