import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import GuardStrict from "../../routes/GuardStrict";
import useAuthStore from "../../store/authStore";
import { mainInstance } from "../../config/api";
import { queryClient } from "../../config/reactQuery";
import { authorizationKeys } from "../../services/authorizationService";
import { useUsers } from "../../modules/generalSettings/pages/Users/infrastructure/useServices";

vi.mock("sileo", () => ({ sileo: { error: vi.fn(), success: vi.fn() } }));
const originalAdapter = mainInstance.defaults.adapter;
const context = { roles: [], actions: [], modules: [{ module_group_key: "settings", translates: [], modules: [
  { key: "usuarios", link: "/settings/users", translates: [] },
] }] };
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({ config, data, status: 200, statusText: "OK", headers: {} });
const signIn = () => useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Test" } });

function PrivatePage() {
  useUsers();
  return <button>Private control</button>;
}

function renderRoute(path = "/settings/users") {
  const router = createMemoryRouter([
    { path: "/settings/users", element: <GuardStrict modulePath="/settings/users"><PrivatePage /></GuardStrict> },
    { path: "/login", element: <p>Login page</p> },
    { path: "/404", element: <p>No access</p> },
  ], { initialEntries: [path] });
  render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}

beforeEach(() => { useAuthStore.getState().logout(); vi.clearAllMocks(); });
afterEach(() => { useAuthStore.getState().logout(); mainInstance.defaults.adapter = originalAdapter; });

describe("GuardStrict", () => {
  it("redirects a visitor to login without requesting context or page data", async () => {
    const adapter = vi.fn();
    mainInstance.defaults.adapter = adapter;
    renderRoute();
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(adapter).not.toHaveBeenCalled();
  });

  it("waits for assignments before mounting a directly opened private route", async () => {
    signIn();
    let finish!: () => void;
    const urls: string[] = [];
    mainInstance.defaults.adapter = async (config) => {
      urls.push(config.url!);
      if (config.url?.endsWith("/authorization/context")) {
        await new Promise<void>((resolve) => { finish = resolve; });
        return response(config, context);
      }
      return response(config, { data: [] });
    };
    renderRoute("/settings/users/");
    await waitFor(() => expect(finish).toBeDefined());
    expect(screen.queryByText("Private control")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Comprobando acceso");
    expect(urls).toHaveLength(1);
    await act(async () => finish());
    expect(await screen.findByText("Private control")).toBeInTheDocument();
    await waitFor(() => expect(urls).toHaveLength(2));
    expect(urls[1]).toMatch(/\/users$/);
  });

  it.each([
    { modules: [] },
    { modules: [{ module_group_key: "settings", translates: [], modules: [{ key: "roles", translates: [] }] }] },
    { modules: [{ module_group_key: "settings", translates: [], modules: [{ key: "settings", link: "/settings", translates: [] }] }] },
  ])(
    "denies the route when its own module is not assigned", async ({ modules }) => {
      signIn();
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, { ...context, modules }));
      mainInstance.defaults.adapter = adapter;
      renderRoute();
      expect(await screen.findByText("No access")).toBeInTheDocument();
      expect(adapter).toHaveBeenCalledOnce();
      expect(screen.queryByText("Private control")).not.toBeInTheDocument();
    },
  );

  it("keeps the page blocked after a context failure and allows retry", async () => {
    signIn();
    let fail = true;
    mainInstance.defaults.adapter = async (config) => {
      if (fail) throw new AxiosError("Unavailable", "ERR_BAD_RESPONSE", config, undefined, {
        ...response(config, { message: "core:server_error_alert" }), status: 503,
      });
      return response(config, config.url?.endsWith("/authorization/context") ? context : { data: [] });
    };
    renderRoute();
    expect(await screen.findByRole("alert")).toHaveTextContent("Hubo un error");
    expect(screen.queryByText("Private control")).not.toBeInTheDocument();
    expect(sileo.error).toHaveBeenCalled();
    fail = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Private control")).toBeInTheDocument();
  });

  it("preserves the authorized view while renewing and removes it if the assignment disappears", async () => {
    signIn();
    mainInstance.defaults.adapter = async (config) => response(config, config.url?.endsWith("/authorization/context") ? context : { data: [] });
    renderRoute();
    const control = await screen.findByText("Private control");
    act(() => useAuthStore.getState().setRefreshing(true));
    expect(screen.getByText("Private control")).toBe(control);
    expect(control.closest("[inert]")).not.toBeNull();
    act(() => {
      queryClient.setQueryData([...authorizationKeys.context(), "42"], { ...context, modules: [] });
    });
    expect(await screen.findByText("No access")).toBeInTheDocument();
  });
});
