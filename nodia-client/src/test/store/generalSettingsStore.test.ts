import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import useGeneralSettingsStore from "../../../src/store/generalSettings/generalSettingsStore";
import {
  useGeneralSettings,
  useUserModules,
  useUserRoles,
  useUserActions,
  useHasAction,
  useHasRole,
  useGeneralSettingsHandlers,
} from "../../../src/store/generalSettings/useGeneralSettings";
import type { AuthorizationContextResponse } from "../../../src/store/generalSettings/types";

const mockContextData: AuthorizationContextResponse = {
  roles: ["admin", "editor"],
  actions: [
    {
      key: "CREATE_USER",
      description: "Can create user",
      translates: [
        { key: "key", es: "Crear Usuario", en: "Create User" },
      ],
    },
    {
      key: "DELETE_USER",
      description: "Can delete user",
      translates: [],
    },
  ],
  modules: [
    {
      module_group_key: "settings",
      translates: [
        { key: "key", es: "Configuración", en: "Settings" },
      ],
      modules: [
        {
          key: "users",
          link: "/settings/users",
          translates: [
            { key: "key", es: "Usuarios", en: "Users" },
          ],
        },
      ],
    },
  ],
};

describe("generalSettingsStore", () => {
  beforeEach(() => {
    act(() => {
      useGeneralSettingsStore.getState().clearContext();
    });
  });

  it("should have initial state with empty arrays and isLoaded=false", () => {
    const state = useGeneralSettingsStore.getState();
    expect(state.roles).toEqual([]);
    expect(state.actions).toEqual([]);
    expect(state.modules).toEqual([]);
    expect(state.isLoaded).toBe(false);
  });

  it("should update state when setContext is called", () => {
    act(() => {
      useGeneralSettingsStore.getState().setContext(mockContextData);
    });

    const state = useGeneralSettingsStore.getState();
    expect(state.roles).toEqual(["admin", "editor"]);
    expect(state.actions).toHaveLength(2);
    expect(state.modules).toHaveLength(1);
    expect(state.isLoaded).toBe(true);
  });

  it("should clear state when clearContext is called", () => {
    act(() => {
      useGeneralSettingsStore.getState().setContext(mockContextData);
    });
    expect(useGeneralSettingsStore.getState().isLoaded).toBe(true);

    act(() => {
      useGeneralSettingsStore.getState().clearContext();
    });

    const state = useGeneralSettingsStore.getState();
    expect(state.roles).toEqual([]);
    expect(state.actions).toEqual([]);
    expect(state.modules).toEqual([]);
    expect(state.isLoaded).toBe(false);
  });

  it("useGeneralSettings hook should return full store state and mutators", () => {
    const { result } = renderHook(() => useGeneralSettings());
    expect(result.current.roles).toEqual([]);
    expect(result.current.isLoaded).toBe(false);

    act(() => {
      result.current.setContext(mockContextData);
    });

    expect(result.current.roles).toEqual(["admin", "editor"]);
    expect(result.current.isLoaded).toBe(true);
  });

  it("selector hooks should return specific parts of state", () => {
    act(() => {
      useGeneralSettingsStore.getState().setContext(mockContextData);
    });

    const { result: rolesResult } = renderHook(() => useUserRoles());
    expect(rolesResult.current).toEqual(["admin", "editor"]);

    const { result: actionsResult } = renderHook(() => useUserActions());
    expect(actionsResult.current).toHaveLength(2);

    const { result: modulesResult } = renderHook(() => useUserModules());
    expect(modulesResult.current).toHaveLength(1);
    expect(modulesResult.current[0].module_group_key).toBe("settings");

    const { result: hasAdminRole } = renderHook(() => useHasRole("admin"));
    expect(hasAdminRole.current).toBe(true);

    const { result: hasGuestRole } = renderHook(() => useHasRole("guest"));
    expect(hasGuestRole.current).toBe(false);

    const { result: hasCreateUserAction } = renderHook(() =>
      useHasAction("CREATE_USER")
    );
    expect(hasCreateUserAction.current).toBe(true);

    const { result: hasUnknownAction } = renderHook(() =>
      useHasAction("UNKNOWN_ACTION")
    );
    expect(hasUnknownAction.current).toBe(false);
  });

  it("useGeneralSettingsHandlers should provide stable callbacks to update store", () => {
    const { result } = renderHook(() => useGeneralSettingsHandlers());

    act(() => {
      result.current.setContext(mockContextData);
    });
    expect(useGeneralSettingsStore.getState().isLoaded).toBe(true);

    act(() => {
      result.current.clearContext();
    });
    expect(useGeneralSettingsStore.getState().isLoaded).toBe(false);
  });
});
