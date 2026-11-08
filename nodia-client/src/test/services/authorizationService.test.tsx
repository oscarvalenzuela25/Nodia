import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import { mainInstance } from "../../config/api";
import { queryClient } from "../../config/reactQuery";
import {
  authorizationKeys,
  useAuthorizationContext,
} from "../../services/authorizationService";
import { notifyAuthError } from "../../services/authFeedback";
import useAuthStore from "../../store/authStore";
import useGeneralSettingsStore from "../../store/generalSettings/generalSettingsStore";
import type { AuthorizationContextResponse } from "../../store/generalSettings/types";
import i18n from "../../translate";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

const originalAdapter = mainInstance.defaults.adapter;
const initialContext: AuthorizationContextResponse = {
  roles: ["reader"], actions: [], modules: [],
};
const updatedContext: AuthorizationContextResponse = {
  roles: ["editor"], actions: [{ key: "fixture:read", description: null, translates: [] }], modules: [],
};
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({
  config, data, status: 200, statusText: "OK", headers: {},
});
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  useAuthStore.getState().logout();
  queryClient.clear();
  vi.clearAllMocks();
  useAuthStore.getState().login({
    token: "fixture", expiresAt: Date.now() + 900000,
    user: { id: "42", name: "Fixture" },
  });
});

afterEach(() => {
  useAuthStore.getState().logout();
  queryClient.clear();
  mainInstance.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("authorization context feedback", () => {
  it("applies initial and changed permissions without announcing a successful read", async () => {
    let requests = 0;
    mainInstance.defaults.adapter = async (config) =>
      response(config, ++requests === 1 ? initialContext : updatedContext);
    const { result } = renderHook(() => useAuthorizationContext(), { wrapper });
    await waitFor(() => expect(useGeneralSettingsStore.getState().roles).toEqual(["reader"]));

    await act(() => result.current.refetch());
    await waitFor(() => {
      expect(useGeneralSettingsStore.getState().roles).toEqual(["editor"]);
      expect(useGeneralSettingsStore.getState().actions).toEqual(updatedContext.actions);
    });
    expect(requests).toBe(2);
    expect(sileo.success).not.toHaveBeenCalled();
    expect(sileo.error).not.toHaveBeenCalled();
  });

  it("still refetches a stale context after session renewal without a success toast", async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, initialContext));
    mainInstance.defaults.adapter = adapter;
    queryClient.setQueryData([...authorizationKeys.context(), "42"], initialContext, {
      updatedAt: Date.now() - 6 * 60 * 1000,
    });
    const { result } = renderHook(() => {
      const query = useAuthorizationContext();
      return { isSuccess: query.isSuccess, isFetching: query.isFetching };
    }, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(adapter).not.toHaveBeenCalled();

    act(() => useAuthStore.getState().setRefreshing(true));
    act(() => useAuthStore.getState().setRefreshing(false));
    await waitFor(() => {
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(result.current.isFetching).toBe(false);
    });
    expect(useGeneralSettingsStore.getState().roles).toEqual(initialContext.roles);
    expect(sileo.success).not.toHaveBeenCalled();
  });

  it("does not fetch when the session is absent", async () => {
    useAuthStore.getState().logout();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, initialContext));
    mainInstance.defaults.adapter = adapter;
    const { result } = renderHook(() => useAuthorizationContext(), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(adapter).not.toHaveBeenCalled();
    expect(useGeneralSettingsStore.getState().isLoaded).toBe(false);
    expect(sileo.success).not.toHaveBeenCalled();
  });

  it.each([
    { body: { message: "Context temporarily unavailable" }, description: "Context temporarily unavailable" },
    { body: { error: "Context rejected" }, description: "Context rejected" },
    { body: {}, description: null },
  ])("notifies a shared failed read once and permits recovery ($description)", async ({ body, description }) => {
    const failure = new AxiosError("Context request failed");
    mainInstance.defaults.adapter = async (config) => {
      failure.response = { ...response(config, body), status: 503 };
      throw failure;
    };
    const { result } = renderHook(() => [useAuthorizationContext(), useAuthorizationContext()], { wrapper });
    await waitFor(() => {
      expect(result.current.every((query) => query.isError)).toBe(true);
      expect(sileo.error).toHaveBeenCalledTimes(1);
    });
    expect(sileo.error).toHaveBeenCalledWith({
      title: i18n.t("core:auth_context_error_title"),
      description: description ?? i18n.t("core:auth_context_error_message"),
    });

    mainInstance.defaults.adapter = async (config) => response(config, updatedContext);
    await act(() => result.current[0].refetch());
    await waitFor(() => expect(result.current.every((query) => query.isSuccess)).toBe(true));
    expect(useGeneralSettingsStore.getState().roles).toEqual(updatedContext.roles);
    expect(sileo.error).toHaveBeenCalledTimes(1);
    expect(sileo.success).not.toHaveBeenCalled();
  });

  it("does not duplicate a session error already reported by the auth layer", async () => {
    const failure = new AxiosError("Session unavailable");
    mainInstance.defaults.adapter = async (config) => {
      failure.response = { ...response(config, { message: "Session unavailable" }), status: 503 };
      notifyAuthError(failure);
      throw failure;
    };
    const { result } = renderHook(() => useAuthorizationContext(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(sileo.error).toHaveBeenCalledTimes(1);
    expect(sileo.error).toHaveBeenCalledWith(expect.objectContaining({ description: "Session unavailable" }));
  });

  it("reports separate failures even when they share the same clock timestamp", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.now());
    let attempts = 0;
    mainInstance.defaults.adapter = async (config) => {
      attempts += 1;
      throw new AxiosError("Context unavailable", "ERR_BAD_RESPONSE", config, undefined, {
        ...response(config, { message: `Failure ${attempts}` }), status: 503,
      });
    };
    const { result } = renderHook(() => useAuthorizationContext(), { wrapper });
    await waitFor(() => expect(sileo.error).toHaveBeenCalledTimes(1));
    await act(() => result.current.refetch());
    await waitFor(() => expect(sileo.error).toHaveBeenCalledTimes(2));
    expect(sileo.error).toHaveBeenLastCalledWith(expect.objectContaining({ description: "Failure 2" }));
  });
});
