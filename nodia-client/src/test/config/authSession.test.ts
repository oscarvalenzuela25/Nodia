import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiInstance, mainInstance, refreshSession, restoreSession, waitForRefresh } from "../../config/api";
import useAuthStore from "../../store/authStore";
import useGeneralSettingsStore from "../../store/generalSettings/generalSettingsStore";
import { queryClient } from "../../config/reactQuery";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const originalAdapter = mainInstance.defaults.adapter;
const session = { token: "old-token", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Oscar" } };
const renewed = { ...session, token: "new-token" };
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, status: 200, statusText: "OK", headers: {} });
const reject = (config: InternalAxiosRequestConfig, status = 401) => new AxiosError("Unauthorized", "ERR_BAD_RESPONSE", config, undefined, {
  config, data: { message: "auth:session_expired" }, status, statusText: "Error", headers: {},
});
beforeEach(() => { useAuthStore.getState().logout(); useAuthStore.getState().login(session); });
afterEach(async () => { await waitForRefresh(); vi.unstubAllGlobals(); mainInstance.defaults.adapter = originalAdapter; useAuthStore.getState().logout(); });

describe("API session renewal", () => {
  it("shares one renewal across the main and additional API clients", async () => {
    let finishRefresh!: () => void;
    const refresh = vi.fn(async (config: InternalAxiosRequestConfig) => {
      await new Promise<void>((resolve) => { finishRefresh = resolve; });
      return response(config, renewed);
    });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith("/auth/refresh")) return refresh(config);
      if (config.headers.Authorization === "Bearer old-token") throw reject(config);
      return response(config, { ok: true });
    });
    mainInstance.defaults.adapter = adapter;
    const secondary = createApiInstance({ adapter });
    const requests = Promise.all([mainInstance.get("/one"), secondary.get("/two")]);
    await vi.waitFor(() => expect(finishRefresh).toBeDefined());
    expect(refresh).toHaveBeenCalledOnce();
    finishRefresh();
    expect((await requests).every((result) => result.data.ok)).toBe(true);
    expect(refresh).toHaveBeenCalledOnce();
    expect(adapter.mock.calls.filter(([config]) => !config.url?.endsWith("/auth/refresh"))).toHaveLength(4);
  });

  it("reuses the token renewed by another tab while waiting for a Web Lock", async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, renewed.user));
    mainInstance.defaults.adapter = adapter;
    const request = vi.fn(async (_name: string, callback: () => Promise<unknown>) => {
      localStorage.setItem("authStore", JSON.stringify({ version: 1, state: renewed }));
      return callback();
    });
    vi.stubGlobal("navigator", { locks: { request } });
    const result = await refreshSession();
    expect(request).toHaveBeenCalledOnce();
    expect(adapter).toHaveBeenCalledOnce();
    expect(adapter.mock.calls[0][0].url).toMatch(/\/auth\/me$/);
    expect(result.token).toBe("new-token");
  });

  it("renews only once for concurrent 401s and retries with the new JWT", async () => {
    let refreshCount = 0;
    mainInstance.defaults.adapter = (async (config) => {
      if (config.url?.endsWith("/auth/refresh")) { refreshCount++; return response(config, renewed); }
      if (config.headers.Authorization === "Bearer old-token") throw reject(config);
      return response(config, { ok: true });
    }) satisfies AxiosAdapter;
    const results = await Promise.all([mainInstance.get("/one"), mainInstance.get("/two"), mainInstance.get("/three")]);
    expect(refreshCount).toBe(1);
    expect(results.every((result) => result.data.ok)).toBe(true);
    expect(useAuthStore.getState().token).toBe("new-token");
  });

  it("does not loop when the retried request is also unauthorized", async () => {
    let refreshCount = 0;
    mainInstance.defaults.adapter = async (config) => {
      if (config.url?.endsWith("/auth/refresh")) { refreshCount++; return response(config, renewed); }
      throw reject(config);
    };
    await expect(mainInstance.get("/protected")).rejects.toMatchObject({ response: { status: 401 } });
    expect(refreshCount).toBe(1);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("clears private cache and permissions when the refresh token is rejected", async () => {
    queryClient.setQueryData(["private"], "sensitive data");
    useGeneralSettingsStore.getState().setContext({ roles: ["admin"], actions: [], modules: [] });
    mainInstance.defaults.adapter = async (config) => { throw reject(config); };
    await expect(refreshSession()).rejects.toThrow();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useGeneralSettingsStore.getState().roles).toEqual([]);
    expect(queryClient.getQueryData(["private"])).toBeUndefined();
  });

  it("does not discard the session on a temporary backend failure", async () => {
    mainInstance.defaults.adapter = async (config) => { throw reject(config, 503); };
    await expect(refreshSession()).rejects.toThrow();
    expect(useAuthStore.getState().token).toBe("old-token");
  });

  it("never restores a session when a refresh finishes after logout", async () => {
    let finish!: () => void;
    mainInstance.defaults.adapter = async (config) => {
      await new Promise<void>((resolve) => { finish = resolve; });
      return response(config, renewed);
    };
    const pending = refreshSession();
    const rejection = expect(pending).rejects.toThrow("Session changed");
    await vi.waitFor(() => expect(finish).toBeDefined());
    useAuthStore.getState().logout();
    finish();
    await rejection;
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem("authStore")).toBeNull();
  });

  it("discards a private response arriving after logout", async () => {
    let finish!: () => void;
    mainInstance.defaults.adapter = async (config) => {
      await new Promise<void>((resolve) => { finish = resolve; });
      return response(config, "private result");
    };
    const pending = mainInstance.get("/private");
    const rejection = expect(pending).rejects.toThrow("Session changed");
    await vi.waitFor(() => expect(finish).toBeDefined());
    useAuthStore.getState().logout();
    finish();
    await rejection;
  });
});

describe("active session transport gate", () => {
  it("also blocks anonymous requests through additional API clients", async () => {
    useAuthStore.getState().logout();
    const adapter = vi.fn();
    const secondary = createApiInstance({ adapter });
    await expect(secondary.get("/users")).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(adapter).not.toHaveBeenCalled();
  });

  it.each(["get", "post", "patch", "delete"])("sends no %s request for a visitor", async (method) => {
    useAuthStore.getState().logout();
    const adapter = vi.fn();
    mainInstance.defaults.adapter = adapter;
    await expect(mainInstance.request({ url: "/users", method })).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(adapter).not.toHaveBeenCalled();
  });

  it("allows the explicitly public login without a session", async () => {
    useAuthStore.getState().logout();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, session));
    mainInstance.defaults.adapter = adapter;
    await mainInstance.post("/auth/login", {}, { skipAuth: true });
    expect(adapter).toHaveBeenCalledOnce();
    expect(adapter.mock.calls[0][0].headers.Authorization).toBeUndefined();
  });

  it("does not trust a persisted token before server validation", async () => {
    useAuthStore.getState().logout();
    localStorage.setItem("authStore", JSON.stringify({ version: 1, state: session }));
    await useAuthStore.persist.rehydrate();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, session.user));
    mainInstance.defaults.adapter = adapter;
    await expect(mainInstance.get("/users")).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(adapter).not.toHaveBeenCalled();
    await Promise.all([restoreSession(), restoreSession()]);
    expect(adapter).toHaveBeenCalledOnce();
    expect(adapter.mock.calls[0][0].url).toMatch(/\/auth\/me$/);
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer old-token");
    expect(useAuthStore.getState().sessionStatus).toBe("authenticated");
    await mainInstance.get("/users");
    expect(adapter).toHaveBeenCalledTimes(2);
  });

  it("renews an expired token before sending a protected request", async () => {
    useAuthStore.getState().login({ ...session, expiresAt: Date.now() - 1 });
    const urls: string[] = [];
    mainInstance.defaults.adapter = async (config) => {
      urls.push(config.url!);
      if (config.url?.endsWith("/auth/refresh")) return response(config, renewed);
      expect(config.headers.Authorization).toBe("Bearer new-token");
      return response(config, []);
    };
    await mainInstance.get("/users");
    expect(urls).toEqual([expect.stringMatching(/\/auth\/refresh$/), "/users"]);
  });

  it("keeps data requests blocked if restoration fails temporarily", async () => {
    useAuthStore.getState().setSessionStatus("restoring");
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => { throw reject(config, 503); });
    mainInstance.defaults.adapter = adapter;
    await expect(restoreSession()).rejects.toThrow();
    expect(useAuthStore.getState().sessionStatus).toBe("unavailable");
    expect(useAuthStore.getState().token).toBe("old-token");
    await expect(mainInstance.get("/users")).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(adapter).toHaveBeenCalledOnce();
  });

  it("ends the saved session if both validation and renewal reject it", async () => {
    useAuthStore.getState().setSessionStatus("restoring");
    const urls: string[] = [];
    mainInstance.defaults.adapter = async (config) => { urls.push(config.url!); throw reject(config); };
    await expect(restoreSession()).rejects.toThrow();
    expect(urls).toEqual([expect.stringMatching(/\/auth\/me$/), expect.stringMatching(/\/auth\/refresh$/)]);
    expect(useAuthStore.getState().sessionStatus).toBe("anonymous");
    await expect(mainInstance.get("/users")).rejects.toMatchObject({ code: "ERR_CANCELED" });
    expect(urls).toHaveLength(2);
  });

  it("does not send data requests when renewal of an expired JWT fails", async () => {
    useAuthStore.getState().login({ ...session, expiresAt: Date.now() - 1 });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => { throw reject(config, 503); });
    mainInstance.defaults.adapter = adapter;
    await expect(mainInstance.get("/users")).rejects.toThrow();
    expect(adapter).toHaveBeenCalledOnce();
    expect(adapter.mock.calls[0][0].url).toMatch(/\/auth\/refresh$/);
    expect(useAuthStore.getState().sessionStatus).toBe("unavailable");
  });

  it("does not restore a validated token after logout", async () => {
    useAuthStore.getState().setSessionStatus("restoring");
    let finish!: () => void;
    mainInstance.defaults.adapter = async (config) => {
      await new Promise<void>((resolve) => { finish = resolve; });
      return response(config, session.user);
    };
    const pending = restoreSession();
    const rejection = expect(pending).rejects.toThrow("Session changed");
    await vi.waitFor(() => expect(finish).toBeDefined());
    useAuthStore.getState().logout();
    finish();
    await rejection;
    expect(useAuthStore.getState().sessionStatus).toBe("anonymous");
    expect(localStorage.getItem("authStore")).toBeNull();
  });
});
