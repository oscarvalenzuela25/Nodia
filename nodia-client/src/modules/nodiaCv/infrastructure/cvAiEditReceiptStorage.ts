import { z } from "zod";
import type { CvAiEditTarget } from "./cvAiEdit";

const key = "nodia-cv-ai-edit-recovery";
const markerSchema = z.object({ baseId: z.uuidv4(), revision: z.int().positive(), requestKey: z.uuidv4() });
const storeSchema = z.object({ owner: z.string(), edits: z.array(markerSchema) });
type Marker = z.output<typeof markerSchema>;

function readStore() {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? storeSchema.safeParse(JSON.parse(raw)).data : undefined;
  } catch {
    return undefined;
  }
}

function writeStore(owner: string, edits: Marker[]) {
  try {
    if (edits.length) window.sessionStorage.setItem(key, JSON.stringify({ owner, edits }));
    else window.sessionStorage.removeItem(key);
  } catch {
    // The open editor retains its active request if tab storage is unavailable.
  }
}

function sameTarget(marker: Marker, target: CvAiEditTarget) {
  return marker.baseId === target.baseId && marker.revision === target.revision;
}

export function cvAiEditRequestKey(owner: string | undefined, target: CvAiEditTarget) {
  const store = readStore();
  return store && store.owner === owner
    ? store.edits.find(marker => sameTarget(marker, target))?.requestKey ?? null
    : null;
}

export function rememberCvAiEditReceipt(owner: string, target: CvAiEditTarget, requestKey: string) {
  const store = readStore();
  const others = store?.owner === owner ? store.edits.filter(marker => !sameTarget(marker, target)) : [];
  writeStore(owner, [...others, { ...target, requestKey }]);
}

export function clearCvAiEditReceipt(owner: string, target: CvAiEditTarget, requestKey: string) {
  const store = readStore();
  if (store?.owner !== owner) return;
  writeStore(owner, store.edits.filter(marker => !sameTarget(marker, target) || marker.requestKey !== requestKey));
}

export function discardOtherCvAiEditReceipts(owner?: string) {
  const store = readStore();
  if (store && store.owner !== owner) writeStore(store.owner, []);
}
