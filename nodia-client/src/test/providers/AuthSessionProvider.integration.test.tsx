import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthSessionProvider from "../../providers/AuthSessionProvider";
import useAuthStore from "../../store/authStore";
import { mainInstance, waitForRefresh } from "../../config/api";
import { queryClient } from "../../config/reactQuery";
import { useUsers } from "../../modules/generalSettings/pages/Users/infrastructure/useServices";
import { useRoles } from "../../modules/generalSettings/pages/Roles/infrastructure/useServices";
import { useActions } from "../../modules/generalSettings/pages/Actions/infrastructure/useServices";
import { useModules, useModuleGroups } from "../../modules/generalSettings/pages/Modules/infrastructure/useServices";
import { useAuthorizationContext } from "../../services/authorizationService";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
const originalAdapter = mainInstance.defaults.adapter;
const session = { token: "jwt", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Oscar" } };
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, status: 200, statusText: "OK", headers: {} });

function AllQueries() {
  useUsers();
  useRoles();
  useActions();
  useModules();
  useModuleGroups();
  useAuthorizationContext();
  return <div>Application</div>;
}

const renderApp = () => render(
  <QueryClientProvider client={queryClient}>
    <AuthSessionProvider><AllQueries /></AuthSessionProvider>
  </QueryClientProvider>,
);

beforeEach(() => useAuthStore.getState().logout());
afterEach(async () => {
  await waitForRefresh();
  mainInstance.defaults.adapter = originalAdapter;
  useAuthStore.getState().logout();
});

describe("authentication before queries", () => {
  it("mounts public content without sending any API request for a visitor", async () => {
    const adapter = vi.fn();
    mainInstance.defaults.adapter = adapter;
    renderApp();
    await act(async () => { await queryClient.invalidateQueries(); });
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(adapter).not.toHaveBeenCalled();
    expect(queryClient.isFetching()).toBe(0);
  });

  it.each([false, true])("waits for persisted session recovery (expired: %s) before all data queries", async (expired) => {
    localStorage.setItem("authStore", JSON.stringify({ version: 1, state: {
      ...session, expiresAt: expired ? Date.now() - 1 : session.expiresAt,
    } }));
    await useAuthStore.persist.rehydrate();
    let finish!: () => void;
    const calls: string[] = [];
    mainInstance.defaults.adapter = async (config) => {
      calls.push(config.url!);
      if (config.url?.includes("/auth/")) {
        await new Promise<void>((resolve) => { finish = resolve; });
        return response(config, expired ? session : session.user);
      }
      expect(config.headers.Authorization).toBe("Bearer jwt");
      return response(config, config.url?.endsWith("/authorization/context")
        ? { roles: [], actions: [], modules: [] } : { data: [], total: 0 });
    };
    renderApp();
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatch(expired ? /\/auth\/refresh$/ : /\/auth\/me$/);
    expect(screen.queryByText("Application")).not.toBeInTheDocument();
    await act(async () => { finish(); });
    await waitFor(() => expect(calls).toHaveLength(7));
    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(calls.slice(1).map((url) => url.replace("/api/v1", "")).sort()).toEqual([
      "/action", "/authorization/context", "/module-groups", "/modules", "/roles", "/users",
    ]);
  });
});
