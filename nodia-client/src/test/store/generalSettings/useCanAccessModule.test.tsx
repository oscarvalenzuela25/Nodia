import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import useAuthStore from "../../../store/authStore";
import useGeneralSettingsStore from "../../../store/generalSettings/generalSettingsStore";
import { useCanAccessModule } from "../../../store/generalSettings/useGeneralSettings";

const modulePath = "/ai-providers";
const modules = [
  {
    module_group_key: "settings",
    translates: [],
    modules: [{ key: "ai-providers", link: modulePath, translates: [] }],
  },
];

beforeEach(() => {
  useAuthStore.getState().logout();
  useAuthStore
    .getState()
    .login({
      token: "synthetic",
      expiresAt: Date.now() + 60_000,
      user: { id: "42", name: "Synthetic" },
    });
});
afterEach(() => useAuthStore.getState().logout());

describe("useCanAccessModule", () => {
  it("allows an assigned module without roles/actions and reacts to revocation", () => {
    useGeneralSettingsStore
      .getState()
      .setContext({ roles: [], actions: [], modules });
    const { result } = renderHook(() => useCanAccessModule(modulePath));
    expect(result.current).toBe(true);
    act(() =>
      useGeneralSettingsStore
        .getState()
        .setContext({
          roles: ["admin"],
          actions: [{ key: "ai:manage", description: null, translates: [] }],
          modules: [],
        }),
    );
    expect(result.current).toBe(false);
  });

  it("allows only the super_admin bypass and waits for a validated session/context", () => {
    useGeneralSettingsStore
      .getState()
      .setContext({ roles: ["super_admin"], actions: [], modules: [] });
    const { result } = renderHook(() => useCanAccessModule(modulePath));
    expect(result.current).toBe(true);
    act(() => useAuthStore.getState().setSessionStatus("restoring"));
    expect(result.current).toBe(false);
    act(() => useAuthStore.getState().setSessionStatus("authenticated"));
    expect(result.current).toBe(true);
    act(() => useGeneralSettingsStore.getState().clearContext());
    expect(result.current).toBe(false);
  });
});
