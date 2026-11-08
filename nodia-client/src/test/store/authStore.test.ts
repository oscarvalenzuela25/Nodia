import { afterEach, beforeEach, describe, expect, it } from "vitest";
import useAuthStore from "../../store/authStore";
import useGeneralSettingsStore from "../../store/generalSettings/generalSettingsStore";
import { queryClient } from "../../config/reactQuery";
import { nodiaAiDraftStoragePrefix } from "../../config/nodiaAiDraftStorage";

beforeEach(() => useAuthStore.getState().logout());
afterEach(() => useAuthStore.getState().logout());

describe("authStore persistence", () => {
  it("hydrates safely when no saved session exists", async () => {
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.persist.hasHydrated()).toBe(true);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("discards persisted demo sessions from the old store version", async () => {
    localStorage.setItem("authStore", JSON.stringify({ version: 0, state: { token: "demo-token", user: { name: "Demo" } } }));
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("clears previous user data when another tab changes the saved account", async () => {
    useAuthStore.getState().login({ token: "user-1-token", user: { id: "1", name: "First user" } });
    queryClient.setQueryData(["private"], "first-user-data");
    useGeneralSettingsStore.getState().setContext({ roles: ["admin"], actions: [], modules: [] });
    const version = useAuthStore.getState().sessionVersion;
    sessionStorage.setItem(nodiaAiDraftStoragePrefix + "synthetic", "synthetic-private-draft");
    localStorage.setItem("authStore", JSON.stringify({ version: 1, state: { token: "user-2-token", expiresAt: Date.now() + 900_000, user: { id: "2", name: "Second user" } } }));
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState().user?.id).toBe("2");
    expect(useAuthStore.getState().sessionVersion).toBeGreaterThan(version);
    expect(useGeneralSettingsStore.getState().roles).toEqual([]);
    expect(queryClient.getQueryData(["private"])).toBeUndefined();
    expect(sessionStorage.getItem(nodiaAiDraftStoragePrefix + "synthetic")).toBeNull();
  });
  it("purges chat drafts on logout before the lazy chat module has loaded", () => {
    sessionStorage.setItem(nodiaAiDraftStoragePrefix + "synthetic", "synthetic-private-draft");
    sessionStorage.setItem("unrelated", "keep");
    useAuthStore.getState().logout();
    expect(sessionStorage.getItem(nodiaAiDraftStoragePrefix + "synthetic")).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("keep");
    sessionStorage.removeItem("unrelated");
  });
  it("preserves drafts when renewing credentials for the same actor", () => {
    const user = { id: "synthetic-same-actor", name: "Synthetic owner" };
    useAuthStore.getState().login({ token: "synthetic-token", user });
    sessionStorage.setItem(nodiaAiDraftStoragePrefix + "synthetic", "synthetic-private-draft");
    useAuthStore.getState().login({ token: "synthetic-renewed-token", user });
    expect(sessionStorage.getItem(nodiaAiDraftStoragePrefix + "synthetic")).toBe("synthetic-private-draft");
    useAuthStore.getState().login({ token: "synthetic-other-token", user: { id: "synthetic-other-actor", name: "Other" } });
    expect(sessionStorage.getItem(nodiaAiDraftStoragePrefix + "synthetic")).toBeNull();
  });
  it("preserves tab-local drafts during initial stored-session recovery", async () => {
    sessionStorage.setItem(nodiaAiDraftStoragePrefix + "synthetic", "synthetic-private-draft");
    localStorage.setItem("authStore", JSON.stringify({ version: 1, state: { token: "synthetic-restored-token", user: { id: "synthetic-owner", name: "Owner" }, expiresAt: Date.now() + 60000 } }));
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState().sessionStatus).toBe("restoring");
    expect(sessionStorage.getItem(nodiaAiDraftStoragePrefix + "synthetic")).toBe("synthetic-private-draft");
  });
});
