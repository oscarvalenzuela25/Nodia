const ownerKey = "nodia:web-push:owner";
const pendingKey = (userId: string) => `nodia:web-push:revoke:${userId}`;

type Owner = {
  userId: string;
  installationId: string;
  keyId: string | null;
  subscriptionDigest?: string;
};
const uuidV4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function readOwner(): Owner | null {
  const raw = localStorage.getItem(ownerKey);
  if (!raw) return null;
  try {
    const owner: Partial<Owner> | null = JSON.parse(raw);
    if (typeof owner?.userId === "string" && typeof owner.installationId === "string" &&
        uuidV4.test(owner.installationId) &&
        (owner.keyId === null || (typeof owner.keyId === "string" && /^[a-f0-9]{64}$/.test(owner.keyId)))) {
      const { userId, installationId, keyId, subscriptionDigest } = owner;
      return {
        userId, installationId, keyId,
        subscriptionDigest: typeof subscriptionDigest === "string" && /^[a-f0-9]{64}$/.test(subscriptionDigest)
          ? subscriptionDigest : undefined,
      };
    }
  } catch {
    // An unknown record does not establish ownership of a browser subscription.
  }
  return null;
}

export function writeOwner(owner: Owner) {
  localStorage.setItem(ownerKey, JSON.stringify(owner));
}

export function readPendingRevocation(userId: string) {
  const id = localStorage.getItem(pendingKey(userId));
  return id && uuidV4.test(id) ? id : null;
}

export function markRevocation(userId: string, installationId: string) {
  localStorage.setItem(pendingKey(userId), installationId);
}

export function clearRevocation(userId: string, installationId: string) {
  if (readPendingRevocation(userId) === installationId) localStorage.removeItem(pendingKey(userId));
}

export function isPushStorageChange(key: string | null) {
  return key === null || key === ownerKey || key.startsWith("nodia:web-push:revoke:");
}

let installationQueue = Promise.resolve();

export function withInstallationLock<T>(task: () => Promise<T>) {
  if (navigator.locks) return navigator.locks.request("nodia:web-push:installation", task);
  const result = installationQueue.then(task);
  installationQueue = result.then(() => undefined, () => undefined);
  return result;
}

export function needsPushReconciliation(userId: string): boolean {
  try {
    const owner = readOwner();
    return Boolean(owner && (owner.keyId || owner.userId !== userId) || readPendingRevocation(userId));
  } catch {
    return false;
  }
}
