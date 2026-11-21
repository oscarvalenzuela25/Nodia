import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPushRegistration, preparePushRegistration, setPushWorkerLocale } from "../../pwa/pushRegistration";

const workerUrl = new URL("/service-worker.js", window.location.href).href;
const scope = new URL("/", window.location.href).href;

function createRegistration(scriptURL = workerUrl) {
  return { scope, active: { scriptURL, state: "activated", postMessage: vi.fn() }, waiting: null, installing: null };
}

const getRegistration = vi.fn();
const register = vi.fn();

beforeEach(() => {
  vi.stubEnv("PROD", true);
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", class {});
  vi.stubGlobal("navigator", { serviceWorker: { getRegistration, register } });
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Web Push registration", () => {
  it("keeps the stable scope and waits for an active worker before allowing subscription", async () => {
    const worker = Object.assign(new EventTarget(), { scriptURL: workerUrl, state: "installing" });
    const registration = { ...createRegistration(), active: null as EventTarget | null, installing: worker };
    register.mockResolvedValue(registration);
    const first = preparePushRegistration();
    const second = preparePushRegistration();
    await vi.waitFor(() => expect(register).toHaveBeenCalledExactlyOnceWith("/service-worker.js", {
      scope: "/", updateViaCache: "none",
    }));
    worker.state = "activated";
    registration.active = worker;
    worker.dispatchEvent(new Event("statechange"));
    await expect(first).resolves.toBe(registration);
    await expect(second).resolves.toBe(registration);
  });

  it("returns a rejected installation promptly and allows a later retry", async () => {
    const worker = Object.assign(new EventTarget(), { scriptURL: workerUrl, state: "redundant" });
    register.mockResolvedValueOnce({ ...createRegistration(), active: null, installing: worker });
    await expect(preparePushRegistration()).rejects.toThrow("installation failed");
    const next = createRegistration();
    register.mockResolvedValueOnce(next);
    await expect(preparePushRegistration()).resolves.toBe(next);
  });

  it("checks ownership for teardown and refuses to replace another worker in the root scope", async () => {
    getRegistration.mockResolvedValue(createRegistration(new URL("/other-worker.js", scope).href));
    await expect(getPushRegistration()).resolves.toBeUndefined();
    await expect(preparePushRegistration()).rejects.toThrow("already in use");
    const known = createRegistration();
    getRegistration.mockResolvedValue(known);
    await expect(getPushRegistration()).resolves.toBe(known);
    expect(register).not.toHaveBeenCalled();
  });

  it("leaves dev and insecure contexts without a newly registered push worker", async () => {
    vi.stubEnv("PROD", false);
    await expect(preparePushRegistration()).rejects.toThrow("unavailable");
    vi.stubEnv("PROD", true);
    vi.stubGlobal("isSecureContext", false);
    await expect(preparePushRegistration()).rejects.toThrow("unavailable");
    expect(register).not.toHaveBeenCalled();
  });

  it("sends the supported locale alone to the active worker", async () => {
    const registration = createRegistration();
    getRegistration.mockResolvedValue(registration);
    const owned = await getPushRegistration();
    if (!owned) throw new Error("Missing test worker");
    setPushWorkerLocale(owned, "en-US");
    setPushWorkerLocale(owned, "es-CL");
    expect(registration.active.postMessage.mock.calls).toEqual([
      [{ type: "nodia:push-worker-locale", locale: "en" }],
      [{ type: "nodia:push-worker-locale", locale: "es" }],
    ]);
  });
});
