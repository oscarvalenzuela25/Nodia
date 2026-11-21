import { CanceledError, isAxiosError } from "axios";
import { getServerErrorCode } from "../../../config/axiosInstance";
import {
  getPushRegistration,
  preparePushRegistration,
  setPushWorkerLocale,
  supportsPushRegistration,
} from "../../../pwa/pushRegistration";
import {
  clearRevocation,
  markRevocation,
  readOwner,
  readPendingRevocation,
  withInstallationLock,
  writeOwner,
} from "./pushOwnership";
import {
  assertNotificationActor,
  readInstallation,
  readPushConfig,
  registerInstallation,
  revokeInstallation,
  type InstallationStatus,
  type NotificationActor,
} from "./services";

type Activation = {
  registration: ServiceWorkerRegistration;
  keyId: string;
  applicationServerKey: Uint8Array<ArrayBuffer>;
  status: InstallationStatus;
};

export type PushDevice =
  | { state: "ready" | "reactivate"; activation: Activation; canDeactivate?: boolean }
  | { state: "active" | "pending" | "denied" | "unsupported" | "install" | "unavailable"; canDeactivate?: boolean };

function decodePublicKey(value: string): Uint8Array<ArrayBuffer> {
  const key = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (byte) => byte.charCodeAt(0));
  if (key.length !== 65 || key[0] !== 4) throw new Error("Invalid VAPID public key");
  return key;
}

function needsHomeScreen() {
  const appleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return appleMobile &&
    !(navigator as Navigator & { standalone?: boolean }).standalone &&
    !window.matchMedia("(display-mode: standalone)").matches;
}

async function unsubscribe(registration?: ServiceWorkerRegistration) {
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  if (!(await subscription.unsubscribe()) && await registration?.pushManager.getSubscription()) {
    throw new Error("PushSubscription still exists");
  }
}

async function subscriptionDigest(installationId: string, subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error("Incomplete PushSubscription");
  // Compare this installation's own subscription without persisting its endpoint or transport keys.
  const input = new TextEncoder().encode(JSON.stringify([installationId, endpoint, keys.p256dh, keys.auth]));
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertActivation(actor: NotificationActor, installationId: string) {
  assertNotificationActor(actor);
  const owner = readOwner();
  if (owner?.userId !== actor.userId || owner.installationId !== installationId ||
      readPendingRevocation(actor.userId)) {
    throw new CanceledError("Push installation changed");
  }
  return owner;
}

async function completeRevocation(
  actor: NotificationActor,
  installationId: string,
  registration?: ServiceWorkerRegistration,
  signal?: AbortSignal,
) {
  const owner = readOwner();
  const ownsBrowserSubscription = owner?.userId === actor.userId && owner.installationId === installationId;
  const [browser, server] = await Promise.allSettled([
    ownsBrowserSubscription ? unsubscribe(registration) : Promise.resolve(),
    (async () => {
      const status = await readInstallation(actor, installationId, signal);
      if (status.state === "active" || status.state === "unregistered") {
        signal?.throwIfAborted();
        const revoked = await revokeInstallation(actor, status);
        if (revoked.state === "active") throw new Error("Push deactivation was not confirmed");
      }
    })(),
  ]);
  if (browser.status === "rejected") throw browser.reason;
  if (server.status === "rejected") throw server.reason;
  // Explicit logout may have happened while this request was in flight.
  assertNotificationActor(actor);
  if (ownsBrowserSubscription) writeOwner({ ...owner, keyId: null, subscriptionDigest: undefined });
  clearRevocation(actor.userId, installationId);
}

let boundSession: { userId: string; version: number; installationId: string; revision: number } | undefined;

function recordBinding(actor: NotificationActor, status: InstallationStatus) {
  boundSession = {
    userId: actor.userId,
    version: actor.sessionVersion,
    installationId: status.installation_id,
    revision: status.revision,
  };
}

function isBound(actor: NotificationActor, status: InstallationStatus) {
  return boundSession?.userId === actor.userId && boundSession.version === actor.sessionVersion &&
    boundSession.installationId === status.installation_id && boundSession.revision === status.revision;
}

export async function inspectPushDevice(
  actor: NotificationActor,
  locale: string,
  signal?: AbortSignal,
): Promise<PushDevice> {
  const previousOwner = readOwner();
  if (previousOwner && previousOwner.userId !== actor.userId) {
    const registration = await getPushRegistration();
    await withInstallationLock(async () => {
      signal?.throwIfAborted();
      assertNotificationActor(actor);
      const owner = readOwner();
      if (!owner || owner.userId === actor.userId) return;
      markRevocation(owner.userId, owner.installationId);
      await unsubscribe(registration);
      assertNotificationActor(actor);
      writeOwner({ userId: actor.userId, installationId: crypto.randomUUID(), keyId: null });
    });
  }

  const pending = readPendingRevocation(actor.userId);
  if (pending) {
    try {
      const registration = await getPushRegistration();
      await withInstallationLock(async () => {
        if (readPendingRevocation(actor.userId) === pending) {
          await completeRevocation(actor, pending, registration, signal);
        }
      });
    } catch {
      return { state: "pending" };
    }
  }

  if (needsHomeScreen()) return { state: "install" };
  if (!supportsPushRegistration() || typeof Notification === "undefined" ||
      typeof crypto.randomUUID !== "function" || !crypto.subtle) {
    return { state: "unsupported" };
  }

  const [config, registration] = await Promise.all([
    readPushConfig(actor, signal),
    preparePushRegistration(),
  ]);
  setPushWorkerLocale(registration, locale);

  return withInstallationLock(async () => {
    signal?.throwIfAborted();
    assertNotificationActor(actor);
    if (readPendingRevocation(actor.userId)) return { state: "pending" };

    let owner = readOwner();
    if (owner?.userId !== actor.userId) {
      // A registration is shared by the origin. Remove the old endpoint before assigning ownership.
      if (owner) markRevocation(owner.userId, owner.installationId);
      await unsubscribe(registration);
      assertNotificationActor(actor);
      owner = { userId: actor.userId, installationId: crypto.randomUUID(), keyId: null };
      writeOwner(owner);
    }

    if (Notification.permission === "denied") return { state: "denied", canDeactivate: Boolean(owner.keyId) };
    if (!config.enabled) return { state: "unavailable", canDeactivate: Boolean(owner.keyId) };
    if (!config.public_key || !config.key_id) throw new Error("Incomplete Web Push configuration");

    const status = await readInstallation(actor, owner.installationId, signal);
    const subscription = await registration.pushManager.getSubscription();
    const activation: Activation = {
      registration,
      keyId: config.key_id,
      applicationServerKey: decodePublicKey(config.public_key),
      status,
    };
    if (status.state === "active" && owner.keyId === config.key_id && subscription &&
        Notification.permission === "granted" &&
        owner.subscriptionDigest === await subscriptionDigest(owner.installationId, subscription)) {
      assertActivation(actor, owner.installationId);
      if (isBound(actor, status)) return { state: "active" };
      // A new session may take ownership of the same still-valid subscription only.
      try {
        signal?.throwIfAborted();
        assertActivation(actor, owner.installationId);
        const rebound = await registerInstallation(actor, status, config.key_id, subscription);
        assertActivation(actor, owner.installationId);
        if (rebound.state !== "active") throw new Error("Push activation was not confirmed");
        recordBinding(actor, rebound);
        return { state: "active" };
      } catch (error) {
        if (!isAxiosError(error) || getServerErrorCode(error) !== "visit_notifications:subscription_rebind_mismatch") {
          throw error;
        }
      }
    }
    // Rotated, lost, revoked, and unconfirmed subscriptions require fresh consent.
    assertActivation(actor, owner.installationId);
    if (subscription) await unsubscribe(registration);
    return {
      state: (status.state === "unregistered" || status.state === "revoked") && !owner.keyId ? "ready" : "reactivate",
      activation,
      canDeactivate: status.state === "active",
    };
  });
}

export function activatePushDevice(actor: NotificationActor, activation: Activation) {
  // subscribe() must be invoked on the click stack, before any promise or API wait.
  assertActivation(actor, activation.status.installation_id);
  const requested = activation.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: activation.applicationServerKey,
  });
  // Prevent an early permission rejection from becoming unhandled while waiting for the lock.
  void requested.catch(() => undefined);
  return withInstallationLock(async () => {
    const subscription = await requested;
    let owner;
    try {
      owner = assertActivation(actor, activation.status.installation_id);
    } catch (error) {
      // The browser may have granted permission after an account change or logout.
      await subscription.unsubscribe();
      throw error;
    }
    if ((await activation.registration.pushManager.getSubscription())?.endpoint !== subscription.endpoint) {
      throw new CanceledError("Push subscription changed");
    }
    const digest = await subscriptionDigest(owner.installationId, subscription);
    assertActivation(actor, owner.installationId);
    writeOwner({ ...owner, keyId: null, subscriptionDigest: undefined });
    let status = activation.status;
    if (status.state === "active") {
      status = await revokeInstallation(actor, status);
      assertActivation(actor, owner.installationId);
    }
    // Retain the public key identifier for this explicit consent. If the response is lost,
    // reconciliation can confirm an active row without ever auto-enrolling a missing row.
    writeOwner({ ...owner, keyId: activation.keyId, subscriptionDigest: digest });
    const confirmed = await registerInstallation(actor, status, activation.keyId, subscription);
    assertActivation(actor, owner.installationId);
    if (confirmed.state !== "active") throw new Error("Push activation was not confirmed");
    recordBinding(actor, confirmed);
  });
}

export function deactivatePushDevice(actor: NotificationActor) {
  assertNotificationActor(actor);
  const owner = readOwner();
  const installationId = readPendingRevocation(actor.userId) ??
    (owner?.userId === actor.userId ? owner.installationId : undefined);
  if (!installationId) throw new CanceledError("Push installation changed");
  markRevocation(actor.userId, installationId);
  return withInstallationLock(async () => {
    const registration = await getPushRegistration();
    await completeRevocation(actor, installationId, registration);
  });
}

export async function cleanupPushOnLogout(userId: string): Promise<void> {
  try {
    const owner = readOwner();
    if (owner?.userId !== userId) return;
    markRevocation(userId, owner.installationId);
    const localCleanup = withInstallationLock(async () => {
      const registration = await getPushRegistration();
      const current = readOwner();
      if (current?.userId === userId && current.installationId === owner.installationId) {
        await unsubscribe(registration);
      }
    }).catch(() => undefined);
    // Server logout should continue even when the browser or another tab is stalled.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([localCleanup, new Promise<void>((resolve) => { timeout = setTimeout(resolve, 750); })]);
    clearTimeout(timeout);
  } catch {
    // Explicit session revocation in Server proceeds independently.
  }
}
