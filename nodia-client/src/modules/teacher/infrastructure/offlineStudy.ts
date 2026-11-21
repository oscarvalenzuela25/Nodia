import {
  isStudyRecord,
  notifyOfflineStudyChange,
  offlineStudyGrantKey,
  offlineStudyGrantSnapshot,
  offlineStudyUuid,
  readOfflineStudyAccount,
  sameOfflineStudyScope,
  type OfflineStudyGrant,
  type OfflineStudyScope,
} from "./offlineStudyIdentity";
import {
  emptyOfflineReadingProgress,
  maxCursorRevision,
  newerOfflineReadingCursor,
  sameOfflineReadingPoint,
  validOfflineReadingBook,
  validOfflineReadingContext,
  validOfflineReadingCursor,
  type OfflineReadingContext,
  type OfflineReadingCursor,
  type OfflineReadingIntent,
  type OfflineReadingOutcome,
  type OfflineReadingPoint,
  type OfflineReadingProgress,
} from "./offlineReadingModel";

export {
  clearOfflineStudyGrant,
  offlineStudyScope,
  readOfflineStudyAccount,
  sameOfflineStudyScope,
  subscribeOfflineStudyChanges,
  type OfflineStudyScope,
} from "./offlineStudyIdentity";
export { sameOfflineReadingPoint, type OfflineReadingContext, type OfflineReadingCursor, type OfflineReadingIntent,
  type OfflineReadingIssue, type OfflineReadingOutcome, type OfflineReadingPoint, type OfflineReadingProgress } from "./offlineReadingModel";

const databaseName = "nodia-teacher-offline";
const grantStore = "grants";
const copyLifetimeMs = 24 * 60 * 60 * 1000;
const maxCopies = 10;
const maxCopyBytes = 256 * 1024;
const maxReadingBytes = 32 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type OfflineStudyBlock = { id: string; title: string; body_markdown: string };

export type OfflineStudyMaterial = {
  studyId: string;
  unitId: string;
  planRevisionId: string;
  contentVersionId: string;
  title: string;
  blocks: readonly OfflineStudyBlock[];
  readingContext?: OfflineReadingContext;
};

export type OfflineStudySummary = Omit<OfflineStudyMaterial, "blocks"> & {
  id: string;
  downloadedAt: number;
  expiresAt: number;
};

export type OfflineStudyCopy = OfflineStudySummary & { blocks: OfflineStudyBlock[] };

export class OfflineStudyError extends Error {
  readonly code: "stale" | "limit" | "too-large" | "invalid" | "unavailable" | "blocked";

  constructor(code: OfflineStudyError["code"]) {
    super(code);
    this.name = "OfflineStudyError";
    this.code = code;
  }
}

type EncryptedCopy = Pick<OfflineStudySummary, "id" | "downloadedAt" | "expiresAt"> & {
  iv: Uint8Array<ArrayBuffer>;
  sealed: ArrayBuffer;
};

type StoredGrant = OfflineStudyGrant & {
  key: CryptoKey;
  copies: EncryptedCopy[];
  reading?: EncryptedReadingBook;
};

type ReadingBook = Record<string, OfflineReadingProgress>;
type EncryptedReadingBook = { stamp: string; iv: Uint8Array<ArrayBuffer>; sealed: ArrayBuffer };

function validId(value: unknown): value is string {
  return typeof value === "string" && offlineStudyUuid.test(value);
}

function validBlocks(value: unknown): value is OfflineStudyBlock[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  for (const block of value) {
    if (!isStudyRecord(block) || typeof block.id !== "string" || typeof block.title !== "string" ||
      typeof block.body_markdown !== "string") return false;
  }
  return true;
}

export function makeOfflineStudyCopy(input: unknown, downloadedAt: number): OfflineStudyCopy {
  if (!isStudyRecord(input) || !validId(input.studyId) || !validId(input.unitId) || !validId(input.planRevisionId) ||
    !validId(input.contentVersionId) || typeof input.title !== "string" || !input.title.trim() ||
    !validBlocks(input.blocks) || !Number.isSafeInteger(downloadedAt) || downloadedAt < 0) throw new OfflineStudyError("invalid");
  const { studyId, unitId, planRevisionId, contentVersionId, title, blocks } = input;
  const readingContext = input.readingContext;
  if (readingContext !== undefined && !validOfflineReadingContext(readingContext)) throw new OfflineStudyError("invalid");
  const id = `${studyId}:${unitId}`.toLowerCase();
  return { id, studyId, unitId, planRevisionId, contentVersionId, title,
    downloadedAt, expiresAt: downloadedAt + copyLifetimeMs,
    blocks: blocks.map(({ id, title, body_markdown }) => ({ id, title, body_markdown })),
    ...(readingContext && { readingContext: {
      sectionId: readingContext.sectionId, cursorRevision: readingContext.cursorRevision, savedBlockId: readingContext.savedBlockId ?? null,
    } }),
  };
}

function connect(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined" || !globalThis.crypto?.subtle) return Promise.reject(new OfflineStudyError("unavailable"));
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(databaseName, 1);
    let blocked = false;
    open.onupgradeneeded = () => { open.result.createObjectStore(grantStore, { keyPath: "grantId" }); };
    open.onsuccess = () => {
      const database = open.result;
      if (blocked) database.close();
      else {
        database.onversionchange = () => database.close();
        resolve(database);
      }
    };
    open.onblocked = () => { blocked = true; reject(new OfflineStudyError("unavailable")); };
    open.onerror = () => reject(open.error ?? new OfflineStudyError("unavailable"));
  });
}

async function withDatabase<T>(run: (database: IDBDatabase) => Promise<T>): Promise<T> {
  const database = await connect();
  try { return await run(database); } finally { database.close(); }
}

function readGrant(database: IDBDatabase, grantId: string): Promise<StoredGrant | undefined> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(grantStore).objectStore(grantStore).get(grantId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new OfflineStudyError("unavailable"));
  });
}

function writeGrant(
  database: IDBDatabase,
  grantId: string,
  rewrite: (previous: StoredGrant | undefined) => StoredGrant | undefined,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const transaction = database.transaction(grantStore, "readwrite");
    const store = transaction.objectStore(grantStore);
    const request = store.get(grantId);
    let error: unknown;
    function abort() {
      try { transaction.abort(); } catch { /* The transaction may have already committed. */ }
    }
    signal?.addEventListener("abort", abort, { once: true });
    request.onsuccess = () => {
      try {
        signal?.throwIfAborted();
        // Schedule writes within this IndexedDB callback, without awaiting Web Crypto here.
        const next = rewrite(request.result);
        if (next) store.put(next);
        else store.delete(grantId);
      } catch (cause) {
        error = cause;
        abort();
      }
    };
    transaction.oncomplete = () => { signal?.removeEventListener("abort", abort); resolve(); };
    transaction.onabort = () => {
      signal?.removeEventListener("abort", abort);
      reject(error ?? signal?.reason ?? transaction.error ?? new OfflineStudyError("unavailable"));
    };
  });
}

function canUseGrant(grant: StoredGrant | undefined, expected: OfflineStudyGrant): grant is StoredGrant {
  return Boolean(grant && grant.grantId === expected.grantId && sameOfflineStudyScope(grant, expected) &&
    grant.key?.algorithm?.name === "AES-GCM" && grant.key.extractable === false &&
    Array.isArray(grant.copies) && grant.copies.length <= maxCopies);
}

function isFresh(copy: unknown, now = Date.now()): copy is EncryptedCopy {
  return isStudyRecord(copy) && typeof copy.id === "string" && typeof copy.downloadedAt === "number" &&
    Number.isSafeInteger(copy.downloadedAt) && copy.expiresAt === copy.downloadedAt + copyLifetimeMs &&
    copy.downloadedAt <= now && now < copy.expiresAt && copy.iv instanceof Uint8Array && copy.iv.byteLength === 12 &&
    copy.sealed instanceof ArrayBuffer && copy.sealed.byteLength <= maxCopyBytes + 16;
}

function authenticatedMetadata(grant: OfflineStudyGrant, copy: Pick<EncryptedCopy, "id" | "downloadedAt" | "expiresAt">) {
  return encoder.encode(JSON.stringify([1, grant.grantId, grant.ownerId, grant.sessionId, copy.id, copy.downloadedAt, copy.expiresAt]));
}

async function seal(grant: StoredGrant, copy: OfflineStudyCopy, bytes: Uint8Array<ArrayBuffer>): Promise<EncryptedCopy> {
  const { id, downloadedAt, expiresAt } = copy;
  const metadata = { id, downloadedAt, expiresAt };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: authenticatedMetadata(grant, metadata) }, grant.key, bytes);
  return { ...metadata, iv, sealed };
}

async function unseal(grant: StoredGrant, encrypted: EncryptedCopy): Promise<OfflineStudyCopy | null> {
  if (!isFresh(encrypted)) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: encrypted.iv, additionalData: authenticatedMetadata(grant, encrypted) }, grant.key, encrypted.sealed);
    const copy = makeOfflineStudyCopy(JSON.parse(decoder.decode(plain)), encrypted.downloadedAt);
    return copy.id === encrypted.id && isFresh(encrypted) ? copy : null;
  } catch {
    return null;
  }
}

function summary(copy: OfflineStudyCopy): OfflineStudySummary {
  const { id, studyId, unitId, planRevisionId, contentVersionId, title, downloadedAt, expiresAt, readingContext } = copy;
  return { id, studyId, unitId, planRevisionId, contentVersionId, title, downloadedAt, expiresAt, ...(readingContext && { readingContext }) };
}

function isCurrentScope(scope: OfflineStudyScope, rawGrant: string | null): boolean {
  return sameOfflineStudyScope(readOfflineStudyAccount()?.scope ?? null, scope) && offlineStudyGrantSnapshot().raw === rawGrant;
}

export async function saveOfflineStudy(
  scope: OfflineStudyScope,
  material: OfflineStudyMaterial,
  isCurrent: () => boolean,
  signal?: AbortSignal,
): Promise<OfflineStudySummary> {
  const snapshot = offlineStudyGrantSnapshot();
  function checkCurrent() {
    if (!isCurrent() || !isCurrentScope(scope, snapshot.raw)) throw new OfflineStudyError("stale");
  }
  signal?.throwIfAborted();
  checkCurrent();
  const copy = makeOfflineStudyCopy(material, Date.now());
  const bytes = encoder.encode(JSON.stringify(copy));
  if (bytes.byteLength > maxCopyBytes) throw new OfflineStudyError("too-large");

  return withDatabase(async database => {
    const marker = snapshot.grant;
    const previous = marker && sameOfflineStudyScope(marker, scope) ? await readGrant(database, marker.grantId) : undefined;
    const existing = marker && canUseGrant(previous, marker) ? previous : undefined;
    const grant: StoredGrant = existing ?? { ...scope, grantId: crypto.randomUUID(),
      key: await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]), copies: [],
    };
    const encrypted = await seal(grant, copy, bytes);
    await writeGrant(database, grant.grantId, current => {
      checkCurrent();
      if (existing && !canUseGrant(current, grant)) throw new OfflineStudyError("stale");
      const active = (current?.copies ?? []).filter(previousCopy => isFresh(previousCopy));
      const previousCopy = active.find(item => item.id === copy.id);
      const otherCopies = active.filter(item => item.id !== copy.id);
      if (otherCopies.length >= maxCopies) throw new OfflineStudyError("limit");
      if (previousCopy && previousCopy.downloadedAt > encrypted.downloadedAt) throw new OfflineStudyError("stale");
      return { ...(current ?? grant), copies: [...otherCopies, encrypted] };
    }, signal);
    try {
      checkCurrent();
      if (!existing) localStorage.setItem(offlineStudyGrantKey, JSON.stringify({ ...scope, grantId: grant.grantId }));
    } catch (error) {
      if (!existing) await writeGrant(database, grant.grantId, () => undefined).catch(() => undefined);
      throw error;
    }
    notifyOfflineStudyChange();
    if (marker && marker.grantId !== grant.grantId) void deleteOfflineStudyGrant(marker.grantId).catch(() => undefined);
    return summary(copy);
  });
}

async function withCurrentGrant<T>(empty: T, read: (grant: StoredGrant, database: IDBDatabase, isCurrent: () => boolean) => Promise<T>): Promise<T> {
  const { raw, grant } = offlineStudyGrantSnapshot();
  if (!grant || !isCurrentScope(grant, raw)) return empty;
  return withDatabase(async database => {
    const stored = await readGrant(database, grant.grantId);
    const current = () => isCurrentScope(grant, raw);
    if (!canUseGrant(stored, grant) || !current()) return empty;
    const result = await read(stored, database, current);
    return current() ? result : empty;
  });
}

export function listOfflineStudy(): Promise<OfflineStudySummary[]> {
  return withCurrentGrant<OfflineStudySummary[]>([], async (grant, database, current) => {
    if (grant.copies.some(copy => !isFresh(copy))) {
      await writeGrant(database, grant.grantId, stored => {
        if (!current() || !canUseGrant(stored, grant)) throw new OfflineStudyError("stale");
        return { ...stored, copies: stored.copies.filter(copy => isFresh(copy)) };
      }).catch(() => undefined);
    }
    const copies = await Promise.all(grant.copies.map(copy => unseal(grant, copy)));
    return copies.filter(copy => copy !== null).sort((a, b) => b.downloadedAt - a.downloadedAt).map(summary);
  });
}

export function openOfflineStudy(id: string): Promise<OfflineStudyCopy | null> {
  return withCurrentGrant<OfflineStudyCopy | null>(null, async grant => {
    const encrypted = grant.copies.find(copy => isFresh(copy) && copy.id === id);
    return encrypted ? unseal(grant, encrypted) : null;
  });
}

export async function removeOfflineStudy(id: string): Promise<void> {
  const removed = await withCurrentGrant(false, async (grant, database, current) => {
    await writeGrant(database, grant.grantId, stored => {
      if (!current() || !canUseGrant(stored, grant)) throw new OfflineStudyError("stale");
      return { ...stored, copies: stored.copies.filter(copy => isFresh(copy) && copy.id !== id) };
    });
    return true;
  });
  if (removed) notifyOfflineStudyChange();
}

export function deleteOfflineStudyGrant(grantId: string): Promise<void> {
  return validId(grantId) ? withDatabase(database => writeGrant(database, grantId, () => undefined)) : Promise.resolve();
}

function readingAdditionalData(grant: StoredGrant, stamp: string) {
  return encoder.encode(JSON.stringify(["reading/1", grant.grantId, grant.ownerId, grant.sessionId, stamp]));
}

async function readReadingBook(grant: StoredGrant): Promise<ReadingBook> {
  if (!grant.reading) return {};
  const { stamp, iv, sealed } = grant.reading;
  if (!validId(stamp) || !(iv instanceof Uint8Array) || iv.byteLength !== 12 ||
    !(sealed instanceof ArrayBuffer) || sealed.byteLength > maxReadingBytes + 16) throw new OfflineStudyError("unavailable");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: readingAdditionalData(grant, stamp) }, grant.key, sealed);
  const book: unknown = JSON.parse(decoder.decode(plain));
  if (!validOfflineReadingBook(book, maxCopies)) throw new OfflineStudyError("unavailable");

  // A removed, expired or replaced download cannot dispatch its old reading intent.
  const liveCopies = new Map(grant.copies.filter(copy => isFresh(copy)).map(copy => [copy.id, copy.expiresAt]));
  const liveStudies = new Set(Array.from(liveCopies.keys(), id => id.split(":")[0]));
  return Object.fromEntries(Object.entries(book).filter(([studyId]) => liveStudies.has(studyId)).map(([studyId, progress]) => {
    const intent = progress.intent;
    if (intent && liveCopies.get(intent.copyId) !== intent.expiresAt) {
      return [studyId, { ...progress, intent: null }];
    }
    return [studyId, progress];
  }));
}

async function sealReadingBook(grant: StoredGrant, book: ReadingBook): Promise<EncryptedReadingBook> {
  const bytes = encoder.encode(JSON.stringify(book));
  if (bytes.byteLength > maxReadingBytes) throw new OfflineStudyError("too-large");
  const stamp = crypto.randomUUID();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: readingAdditionalData(grant, stamp) }, grant.key, bytes);
  return { stamp, iv, sealed };
}

class ReadingBookChanged extends Error {}

function sameCopies(a: StoredGrant, b: StoredGrant): boolean {
  if (a.copies.length !== b.copies.length) return false;
  return a.copies.every((copy, index) => {
    const other = b.copies[index];
    return copy?.id === other?.id && copy?.downloadedAt === other?.downloadedAt &&
      copy?.iv instanceof Uint8Array && other?.iv instanceof Uint8Array && copy.iv.length === other.iv.length &&
      copy.iv.every((byte, position) => byte === other.iv[position]);
  });
}

type ReadingChange<T> = { book: ReadingBook; value: T; expiresAt?: number };

async function changeReading<T>(empty: T, edit: (book: ReadingBook, grant: StoredGrant) => Promise<ReadingChange<T>>): Promise<T> {
  let changed = false;
  const value = await withCurrentGrant(empty, async (initial, database, current) => {
    let grant = initial;
    for (let attempt = 0; attempt < 8; attempt++) {
      const book = await readReadingBook(grant);
      if (!current()) return empty;
      const next = await edit(book, grant);
      if (!current()) return empty;
      if (next.book === book) return next.value;
      const reading = await sealReadingBook(grant, next.book);
      try {
        await writeGrant(database, grant.grantId, stored => {
          if (!current() || !canUseGrant(stored, grant) || (next.expiresAt !== undefined && next.expiresAt <= Date.now())) {
            throw new OfflineStudyError("stale");
          }
          // Encryption cannot await inside IndexedDB. Commit against the same snapshot, or reread and retry.
          if (stored.reading?.stamp !== grant.reading?.stamp || !sameCopies(stored, grant)) throw new ReadingBookChanged();
          return { ...stored, reading };
        });
        changed = true;
        return next.value;
      } catch (error) {
        if (!(error instanceof ReadingBookChanged)) throw error;
        const latest = await readGrant(database, grant.grantId);
        if (!current() || !canUseGrant(latest, grant)) return empty;
        grant = latest;
      }
    }
    throw new OfflineStudyError("unavailable");
  });
  if (changed) notifyOfflineStudyChange();
  return value;
}

async function copyIn(grant: StoredGrant, copyId: string): Promise<OfflineStudyCopy | null> {
  const copy = grant.copies.find(candidate => candidate.id === copyId && isFresh(candidate));
  return copy ? unseal(grant, copy) : null;
}

function pointFor(copy: OfflineStudyCopy, blockId: string): OfflineReadingPoint | null {
  if (!copy.readingContext || !blockId || blockId.length > 64 || !copy.blocks.some(block => block.id === blockId)) return null;
  return { planRevisionId: copy.planRevisionId, sectionId: copy.readingContext.sectionId,
    unitId: copy.unitId, contentVersionId: copy.contentVersionId, blockId };
}

function intentMatchesCopy(intent: OfflineReadingIntent, copy: OfflineStudyCopy | null): boolean {
  return Boolean(copy && copy.expiresAt === intent.expiresAt && sameOfflineReadingPoint(pointFor(copy, intent.point.blockId), intent.point));
}

export async function queueOfflineReadingPoint(copyId: string, blockId: string): Promise<OfflineReadingIntent | null> {
  const result = await changeReading<OfflineReadingIntent | null | undefined>(undefined, async (book, grant) => {
    const copy = await copyIn(grant, copyId);
    if (!copy?.readingContext) throw new OfflineStudyError("stale");
    const point = pointFor(copy, blockId);
    if (!point) throw new OfflineStudyError("invalid");
    const studyId = copy.studyId.toLowerCase();
    const progress = book[studyId] ?? emptyOfflineReadingProgress;
    if (progress.intent && sameOfflineReadingPoint(progress.intent.point, point) && progress.intent.state !== "rejected") {
      return { book, value: progress.intent };
    }
    if (progress.intent && progress.intent.state !== "pending") throw new OfflineStudyError("blocked");
    const fromCopy: OfflineReadingCursor = {
      revision: copy.readingContext.cursorRevision,
      point: copy.readingContext.savedBlockId ? pointFor(copy, copy.readingContext.savedBlockId) : null,
    };
    const baseline = newerOfflineReadingCursor(progress.confirmed, fromCopy);
    if (sameOfflineReadingPoint(baseline.point, point)) {
      // Returning to the last confirmed point cancels a never-sent local choice.
      if (!progress.intent) return { book, value: null };
      return { book: { ...book, [studyId]: { ...progress, intent: null } }, value: null };
    }
    if (baseline.revision === maxCursorRevision) throw new OfflineStudyError("stale");
    const intent: OfflineReadingIntent = { studyId, copyId, requestKey: crypto.randomUUID(),
      expectedCursorRevision: baseline.revision, expiresAt: copy.expiresAt, point, state: "pending" };
    return { book: { ...book, [studyId]: { ...progress, intent } }, value: intent, expiresAt: intent.expiresAt };
  });
  if (result === undefined) throw new OfflineStudyError("stale");
  return result;
}

export function listOfflineReadingIntents(): Promise<OfflineReadingIntent[]> {
  return withCurrentGrant<OfflineReadingIntent[]>([], async grant => Object.values(await readReadingBook(grant))
    .flatMap(({ intent }) => intent ? [intent] : []));
}

export function readOfflineReadingProgress(studyId: string): Promise<OfflineReadingProgress> {
  return withCurrentGrant(emptyOfflineReadingProgress, async grant => (await readReadingBook(grant))[studyId.toLowerCase()] ??
    emptyOfflineReadingProgress);
}

export function claimOfflineReadingIntent(studyId: string, requestKey: string): Promise<OfflineReadingIntent | null> {
  return changeReading<OfflineReadingIntent | null>(null, async (book, grant) => {
    const progress = book[studyId];
    const intent = progress?.intent;
    if (!intent || intent.requestKey !== requestKey || (intent.state !== "pending" && intent.state !== "uncertain")) {
      return { book, value: null };
    }
    if (!intentMatchesCopy(intent, await copyIn(grant, intent.copyId))) {
      const rejected: OfflineReadingIntent = { ...intent, state: "rejected", issue: "stale" };
      return { book: { ...book, [studyId]: { ...progress, intent: rejected } }, value: null };
    }
    if (intent.state === "uncertain") return { book, value: intent };
    const claimed: OfflineReadingIntent = { ...intent, state: "uncertain" };
    return { book: { ...book, [studyId]: { ...progress, intent: claimed } }, value: claimed, expiresAt: intent.expiresAt };
  });
}

export function settleOfflineReadingIntent(studyId: string, requestKey: string, outcome: OfflineReadingOutcome): Promise<boolean> {
  return changeReading(false, async book => {
    const progress = book[studyId];
    const intent = progress?.intent;
    if (!intent || intent.requestKey !== requestKey || intent.state !== "uncertain") return { book, value: false };
    let next: OfflineReadingProgress;
    if (outcome.kind === "applied") {
      if (!validOfflineReadingCursor(outcome.cursor) || outcome.cursor.revision <= intent.expectedCursorRevision ||
        !sameOfflineReadingPoint(outcome.cursor.point, intent.point)) throw new OfflineStudyError("invalid");
      next = { intent: null, confirmed: newerOfflineReadingCursor(progress.confirmed, outcome.cursor) };
    } else {
      if (outcome.serverCursor && !validOfflineReadingCursor(outcome.serverCursor)) throw new OfflineStudyError("invalid");
      next = { ...progress, intent: { ...intent, state: outcome.kind, issue: outcome.issue, serverCursor: outcome.serverCursor } };
    }
    return { book: { ...book, [studyId]: next }, value: true };
  });
}

export function resolveOfflineReadingConflict(studyId: string, requestKey: string, choice: "server" | "local", cursor: OfflineReadingCursor): Promise<boolean> {
  return changeReading(false, async (book, grant) => {
    const progress = book[studyId];
    const intent = progress?.intent;
    if (!intent || intent.requestKey !== requestKey || intent.state !== "conflict" || intent.issue !== "revision" ||
      !intent.serverCursor || !validOfflineReadingCursor(cursor) || cursor.revision !== intent.serverCursor.revision ||
      !sameOfflineReadingPoint(cursor.point, intent.serverCursor.point)) return { book, value: false };
    if (choice === "server" || sameOfflineReadingPoint(cursor.point, intent.point)) return { book: { ...book, [studyId]: {
      intent: null, confirmed: newerOfflineReadingCursor(progress.confirmed, cursor),
    } }, value: true };
    if (cursor.revision === maxCursorRevision || cursor.revision <= intent.expectedCursorRevision ||
      !intentMatchesCopy(intent, await copyIn(grant, intent.copyId))) return { book, value: false };
    const replacement: OfflineReadingIntent = { ...intent, issue: undefined, serverCursor: undefined, state: "pending",
      requestKey: crypto.randomUUID(), expectedCursorRevision: cursor.revision };
    return { book: { ...book, [studyId]: { ...progress, intent: replacement } }, value: true, expiresAt: intent.expiresAt };
  });
}

export function discardOfflineReadingIntent(studyId: string, requestKey: string): Promise<boolean> {
  return changeReading(false, async book => {
    const progress = book[studyId];
    const intent = progress?.intent;
    if (!intent || intent.requestKey !== requestKey || intent.state === "uncertain") return { book, value: false };
    return { book: { ...book, [studyId]: { ...progress, intent: null } }, value: true };
  });
}
