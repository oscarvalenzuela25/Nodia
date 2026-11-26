import { z } from "zod";

const key = "nodia-cv-recovery";
const markerSchema = z.object({
  owner: z.string(),
  requestKey: z.uuidv4(),
  previousKeys: z.array(z.uuidv4()).optional(),
});

function readMarker() {
  try {
    const stored = window.sessionStorage.getItem(key);
    return stored ? markerSchema.safeParse(JSON.parse(stored)).data : undefined;
  } catch {
    return undefined;
  }
}

export function cvRecoveryKeys(owner?: string) {
  const marker = readMarker();
  return marker && marker.owner === owner ? [marker.requestKey, ...(marker.previousKeys ?? [])] : [];
}

function writeKeys(owner: string, keys: string[]) {
  try {
    const [requestKey, ...previousKeys] = Array.from(new Set(keys));
    if (requestKey) {
      window.sessionStorage.setItem(key, JSON.stringify({
        owner,
        requestKey,
        previousKeys: previousKeys.length ? previousKeys : undefined,
      }));
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // In-memory recovery still works when this tab cannot access storage.
  }
}

export function rememberCvReceipt(owner: string, requestKey: string) {
  writeKeys(owner, [requestKey, ...cvRecoveryKeys(owner)]);
}

export function clearCvReceipt(owner: string, requestKey: string) {
  const keys = cvRecoveryKeys(owner);
  if (keys.includes(requestKey)) writeKeys(owner, keys.filter(candidate => candidate !== requestKey));
}

export function discardOtherCvReceipt(owner?: string) {
  const marker = readMarker();
  if (marker && marker.owner !== owner) writeKeys(marker.owner, []);
}
