import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import { mainInstance } from "../../../../../../config/api";
import { queryClient } from "../../../../../../config/reactQuery";
import { useAuthorizationContext } from "../../../../../../services/authorizationService";
import useAuthStore from "../../../../../../store/authStore";
import useGeneralSettingsStore from "../../../../../../store/generalSettings/generalSettingsStore";
import type { AuthorizationContextResponse } from "../../../../../../store/generalSettings/types";
import {
  useUpdateUser,
  useUsers,
} from "../../../../../../modules/generalSettings/pages/Users/infrastructure/useServices";
import type { User } from "../../../../../../modules/generalSettings/pages/Users/types";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

const originalAdapter = mainInstance.defaults.adapter;
const initialContext: AuthorizationContextResponse = {
  roles: ["reader"],
  actions: [],
  modules: [],
};
const updatedContext: AuthorizationContextResponse = {
  roles: ["editor"],
  actions: [],
  modules: [{
    module_group_key: "settings",
    translates: [],
    modules: [{ key: "usuarios", link: "/settings/users", translates: [] }],
  }],
};
const savedUser: User = {
  id: "42",
  name: "Updated",
  email: "fixture@example.test",
  image_url: null,
  is_active: true,
  created_at: "2026-10-04T12:00:00.000Z",
  updated_at: "2026-10-04T13:00:00.000Z",
  roles: [],
};
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({
  config, data, status: 200, statusText: "OK", headers: {},
});
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

function setup({ failWrite = false, failContext = false } = {}) {
  let persisted = false;
  const requests: string[] = [];
  mainInstance.defaults.adapter = async (config) => {
    requests.push(`${config.method} ${config.url}`);
    if (config.method === "put") {
      if (failWrite) {
        throw new AxiosError("Write rejected", "ERR_BAD_RESPONSE", config, undefined, {
          ...response(config, { message: "Write rejected" }), status: 400,
        });
      }
      persisted = true;
      return response(config, savedUser);
    }
    if (config.url?.endsWith("/authorization/context")) {
      if (persisted && failContext) {
        throw new AxiosError("Context unavailable", "ERR_BAD_RESPONSE", config, undefined, {
          ...response(config, { message: "Context unavailable" }), status: 503,
        });
      }
      return response(config, persisted ? updatedContext : initialContext);
    }
    return response(config, {
      data: [{ ...savedUser, name: persisted ? "Updated" : "Original" }],
      meta: { page: 1, limit: 10, total_items: 1, total_pages: 1 },
    });
  };
  const hook = renderHook(() => ({
    context: useAuthorizationContext(),
    users: useUsers(),
    update: useUpdateUser(),
  }), { wrapper });
  return { ...hook, requests };
}

beforeEach(() => {
  useAuthStore.getState().logout();
  queryClient.clear();
  vi.clearAllMocks();
  useAuthStore.getState().login({
    token: "fixture",
    expiresAt: Date.now() + 900000,
    user: { id: "42", name: "Fixture" },
  });
});
afterEach(() => {
  useAuthStore.getState().logout();
  queryClient.clear();
  mainInstance.defaults.adapter = originalAdapter;
});

describe("user updates and authorization context", () => {
  it.each(["42", "84"])("reloads session context after updating user %s", async (userId) => {
    const { result, requests } = setup();
    await waitFor(() => {
      expect(result.current.context.isSuccess).toBe(true);
      expect(result.current.users.isSuccess).toBe(true);
    });
    await act(() => result.current.update.mutateAsync({
      userId, payload: { name: "Updated", roles: ["2"], modules: ["3"] },
    }));

    await waitFor(() => {
      expect(result.current.context.data).toEqual(updatedContext);
      expect(useGeneralSettingsStore.getState().modules).toEqual(updatedContext.modules);
      expect(useGeneralSettingsStore.getState().roles).toEqual(updatedContext.roles);
      expect(result.current.users.data?.data[0].name).toBe("Updated");
    });
    expect(requests.filter((url) => url.endsWith("/authorization/context"))).toHaveLength(2);
    expect(requests.filter((url) => url.endsWith("/users"))).toHaveLength(2);
    expect(requests.findIndex((url) => url.endsWith(`/user/${userId}`)))
      .toBeLessThan(requests.findLastIndex((url) => url.endsWith("/authorization/context")));
    expect(result.current.update.isSuccess).toBe(true);
  });

  it("does not refresh context or users when the update is rejected", async () => {
    const { result, requests } = setup({ failWrite: true });
    await waitFor(() => {
      expect(result.current.context.isSuccess).toBe(true);
      expect(result.current.users.isSuccess).toBe(true);
    });
    await act(async () => {
      await expect(result.current.update.mutateAsync({
        userId: "42", payload: { name: "Updated" },
      })).rejects.toThrow("Write rejected");
    });

    expect(requests.filter((url) => url.endsWith("/authorization/context"))).toHaveLength(1);
    expect(requests.filter((url) => url.endsWith("/users"))).toHaveLength(1);
    expect(result.current.context.data).toEqual(initialContext);
    expect(sileo.error).toHaveBeenCalledWith(expect.objectContaining({ description: "Write rejected" }));
  });

  it("keeps the confirmed write successful if context reload fails and allows retrying the read", async () => {
    const { result, requests } = setup({ failContext: true });
    await waitFor(() => expect(result.current.context.isSuccess).toBe(true));
    await act(() => result.current.update.mutateAsync({
      userId: "42", payload: { name: "Updated" },
    }));
    await waitFor(() => {
      expect(result.current.update.isSuccess).toBe(true);
      expect(result.current.context.isError).toBe(true);
    });
    expect(requests.filter((url) => url.startsWith("put "))).toHaveLength(1);
    expect(sileo.error).toHaveBeenCalled();
    mainInstance.defaults.adapter = async (config) => response(config, updatedContext);
    await act(() => result.current.context.refetch());
    await waitFor(() => expect(result.current.context.data).toEqual(updatedContext));
    expect(requests.filter((url) => url.startsWith("put "))).toHaveLength(1);
  });
});
