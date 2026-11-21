import { CanceledError } from "axios";
import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as registrationApi from "../../../../pwa/pushRegistration";
import {
  activatePushDevice,
  cleanupPushOnLogout,
  deactivatePushDevice,
  inspectPushDevice,
} from "../../../../modules/notifications/infrastructure/pushInstallation";
import { readOwner, readPendingRevocation } from "../../../../modules/notifications/infrastructure/pushOwnership";
import * as services from "../../../../modules/notifications/infrastructure/services";

vi.mock("../../../../pwa/pushRegistration", () => ({
  getPushRegistration: vi.fn(),
  preparePushRegistration: vi.fn(),
  supportsPushRegistration: vi.fn(() => true),
  setPushWorkerLocale: vi.fn(),
}));
vi.mock("../../../../modules/notifications/infrastructure/services", () => ({
  assertNotificationActor: vi.fn(),
  readPushConfig: vi.fn(),
  readInstallation: vi.fn(),
  registerInstallation: vi.fn(),
  revokeInstallation: vi.fn(),
}));

const owner = { userId: "owner", sessionVersion: 0 };
const secondUser = { userId: "second", sessionVersion: 1 };
const keyId = "a".repeat(64);
const publicKey = btoa("\x04" + "\x01".repeat(64)).replace(/=+$/, "");
const unregistered = (id: string): services.InstallationStatus => ({
  installation_id: id, state: "unregistered", revision: 0, updated_at: null,
});

let currentActor = owner;
let currentBrowserSubscription: PushSubscription | null;
let currentServerStatus: services.InstallationStatus | undefined;
const unsubscribe = vi.fn(async () => {
  currentBrowserSubscription = null;
  return true;
});
const endpoint = "https://push.example.test/subscription";
const subscription = {
  endpoint,
  unsubscribe,
  toJSON: () => ({ endpoint, keys: { auth: "synthetic-auth", p256dh: "synthetic-p256dh" } }),
} as unknown as PushSubscription;
const subscribe = vi.fn(async () => {
  currentBrowserSubscription = subscription;
  return subscription;
});
const registration = {
  pushManager: { getSubscription: async () => currentBrowserSubscription, subscribe },
} as unknown as ServiceWorkerRegistration;

async function preparedActivation(actor = owner) {
  const device = await inspectPushDevice(actor, "es");
  if (!("activation" in device)) throw new Error(`Device unavailable: ${device.state}`);
  return device.activation;
}

describe("Web Push installation reconciliation", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    vi.stubGlobal("Notification", { permission: "granted" });
    vi.stubGlobal("crypto", webcrypto);
    currentActor = owner;
    currentBrowserSubscription = null;
    currentServerStatus = undefined;
    vi.mocked(registrationApi.getPushRegistration).mockResolvedValue(registration);
    vi.mocked(registrationApi.preparePushRegistration).mockResolvedValue(registration);
    vi.mocked(services.assertNotificationActor).mockImplementation((actor) => {
      if (actor !== currentActor) throw new CanceledError();
    });
    vi.mocked(services.readPushConfig).mockResolvedValue({ enabled: true, public_key: publicKey, key_id: keyId });
    vi.mocked(services.readInstallation).mockImplementation(async (_, id) =>
      currentServerStatus?.installation_id === id ? currentServerStatus : unregistered(id));
    vi.mocked(services.registerInstallation).mockImplementation(async (_, status) => {
      if (currentServerStatus?.state !== "active") {
        currentServerStatus = { ...status, state: "active", revision: status.revision + 1 };
      }
      return currentServerStatus;
    });
    vi.mocked(services.revokeInstallation).mockImplementation(async (_, status) => {
      currentServerStatus = { ...status, state: "revoked", revision: status.revision + 1 };
      return currentServerStatus;
    });
  });

  it("starts the browser subscription on the activation gesture and requires Server acknowledgment", async () => {
    const activation = await preparedActivation();
    expect(subscribe).not.toHaveBeenCalled();
    expect(services.registerInstallation).not.toHaveBeenCalled();
    const confirmation = activatePushDevice(owner, activation);
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: Uint8Array.from([4, ...new Array<number>(64).fill(1)]),
    });
    expect(services.registerInstallation).not.toHaveBeenCalled();
    await confirmation;
    expect(services.registerInstallation).toHaveBeenCalledWith(owner, activation.status, keyId, subscription);
    await expect(inspectPushDevice(owner, "es")).resolves.toEqual({ state: "active" });
    expect(localStorage.getItem("nodia:web-push:owner")).not.toContain(subscription.endpoint);
  });

  it("confirms an accepted registration after losing the first response, using the same browser subscription", async () => {
    const activation = await preparedActivation();
    vi.mocked(services.registerInstallation).mockImplementationOnce(async (_, status) => {
      currentServerStatus = { ...status, state: "active", revision: 1 };
      throw new Error("Connection lost");
    });
    await expect(activatePushDevice(owner, activation)).rejects.toThrow("Connection lost");
    await expect(inspectPushDevice(owner, "es")).resolves.toEqual({ state: "active" });
    expect(services.registerInstallation).toHaveBeenLastCalledWith(
      owner, expect.objectContaining({ revision: 1 }), keyId, subscription,
    );
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("does not register a missing installation after a failed explicit activation", async () => {
    const activation = await preparedActivation();
    vi.mocked(services.registerInstallation).mockRejectedValueOnce(new Error("Offline"));
    await expect(activatePushDevice(owner, activation)).rejects.toThrow("Offline");
    await expect(inspectPushDevice(owner, "es")).resolves.toMatchObject({ state: "reactivate" });
    expect(services.registerInstallation).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("requires explicit reactivation when the browser replaced the subscription", async () => {
    await activatePushDevice(owner, await preparedActivation());
    currentBrowserSubscription = {
      ...subscription,
      toJSON: () => ({ endpoint, keys: { auth: "changed-auth", p256dh: "synthetic-p256dh" } }),
    };
    await expect(inspectPushDevice(owner, "es")).resolves.toMatchObject({ state: "reactivate" });
    expect(services.registerInstallation).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("cleans a previous account’s subscription even when config is unavailable", async () => {
    const activation = await preparedActivation();
    await activatePushDevice(owner, activation);
    currentActor = secondUser;
    vi.mocked(services.readPushConfig).mockRejectedValueOnce(new Error("Offline"));
    await expect(inspectPushDevice(secondUser, "en")).rejects.toThrow("Offline");
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(readPendingRevocation(owner.userId)).toBe(activation.status.installation_id);
    expect(readOwner()).toMatchObject({ userId: secondUser.userId, keyId: null });
    expect(services.registerInstallation).toHaveBeenCalledTimes(1);
  });

  it("discards a browser activation that resolves after the account changes", async () => {
    const activation = await preparedActivation();
    let allowSubscription!: (value: PushSubscription) => void;
    const permission = new Promise<PushSubscription>((resolve) => { allowSubscription = resolve; });
    subscribe.mockImplementationOnce(() => permission);
    const rejected = expect(activatePushDevice(owner, activation)).rejects.toThrow();
    currentActor = secondUser;
    const nextDevice = inspectPushDevice(secondUser, "en");
    currentBrowserSubscription = subscription;
    allowSubscription(subscription);
    await rejected;
    await expect(nextDevice).resolves.toMatchObject({ state: "ready" });
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(services.registerInstallation).not.toHaveBeenCalled();
  });

  it("preserves an offline deactivation and retries it without subscribing again", async () => {
    await activatePushDevice(owner, await preparedActivation());
    vi.mocked(services.revokeInstallation).mockRejectedValueOnce(new Error("Offline"));
    await expect(deactivatePushDevice(owner)).rejects.toThrow("Offline");
    expect(readPendingRevocation(owner.userId)).toBeTruthy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    await expect(inspectPushDevice(owner, "es")).resolves.toMatchObject({ state: "ready" });
    expect(readPendingRevocation(owner.userId)).toBeNull();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("limits logout cleanup to the existing account’s local installation", async () => {
    await activatePushDevice(owner, await preparedActivation());
    await cleanupPushOnLogout(secondUser.userId);
    expect(unsubscribe).not.toHaveBeenCalled();
    await cleanupPushOnLogout(owner.userId);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(readPendingRevocation(owner.userId)).toBeTruthy();
    expect(services.revokeInstallation).not.toHaveBeenCalled();
  });
});
