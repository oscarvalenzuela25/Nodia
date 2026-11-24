import { z } from "zod";

const key = "nodia-cv-recovery";
const markerSchema = z.object({ owner: z.string(), requestKey: z.uuidv4() });

function readMarker() {
  try {
    const stored = window.sessionStorage.getItem(key);
    return stored ? markerSchema.safeParse(JSON.parse(stored)).data : undefined;
  } catch {
    return undefined;
  }
}

export function cvRecoveryKey(owner?: string) {
  const marker = readMarker();
  return marker && marker.owner === owner ? marker.requestKey : null;
}

export function rememberCvReceipt(owner: string, requestKey: string) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ owner, requestKey }));
  } catch {
    // In-memory recovery still works when this tab cannot access storage.
  }
}

export function clearCvReceipt(requestKey: string) {
  try {
    if (readMarker()?.requestKey === requestKey) window.sessionStorage.removeItem(key);
  } catch {
    // The contextual receipt remains private to the active page.
  }
}

export function discardOtherCvReceipt(owner?: string) {
  const marker = readMarker();
  if (marker && marker.owner !== owner) clearCvReceipt(marker.requestKey);
}
