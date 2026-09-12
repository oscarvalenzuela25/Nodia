import { afterEach, beforeEach, describe, expect, it } from "vitest";
import useAuthStore from "../../store/authStore";
import useGeneralSettingsStore from "../../store/generalSettings/generalSettingsStore";
import { queryClient } from "../../config/reactQuery";

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
    localStorage.setItem("authStore", JSON.stringify({ version: 1, state: { token: "user-2-token", expiresAt: Date.now() + 900_000, user: { id: "2", name: "Second user" } } }));
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState().user?.id).toBe("2");
    expect(useAuthStore.getState().sessionVersion).toBeGreaterThan(version);
    expect(useGeneralSettingsStore.getState().roles).toEqual([]);
    expect(queryClient.getQueryData(["private"])).toBeUndefined();
  });
});
