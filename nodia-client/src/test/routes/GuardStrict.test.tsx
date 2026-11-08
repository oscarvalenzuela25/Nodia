import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const context = {
  roles: [],
  actions: [],
  modules: [
    {
      module_group_key: "settings",
      translates: [],
      modules: [{ key: "usuarios", link: "/users", translates: [] }],
    },
  ],
};
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({
  config,
  data,
  status: 200,
  statusText: "OK",
  headers: {},
});
const signIn = () =>
  useAuthStore
    .getState()
    .login({
      token: "jwt",
      expiresAt: Date.now() + 900_000,
      user: { id: "42", name: "Test" },
    });

function PrivatePage() {
  useUsers();
  return <><button>Private control</button><input aria-label="Private draft" defaultValue="" /></>;
}

function renderRoute(path = "/users", modulePath = "/users") {
  const router = createMemoryRouter(
    [
      {
        path: modulePath,
        element: (
          <GuardStrict modulePath={modulePath}>
            <PrivatePage />
          </GuardStrict>
        ),
      },
      { path: "/", element: <p>Home page</p> },
      { path: "/login", element: <p>Login page</p> },
      { path: "/404", element: <p>No access</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  useAuthStore.getState().logout();
  queryClient.clear();
  vi.clearAllMocks();
});
afterEach(() => {
  useAuthStore.getState().logout();
  queryClient.clear();
  mainInstance.defaults.adapter = originalAdapter;
});

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
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return response(config, context);
      }
      return response(config, { data: [] });
    };
    renderRoute("/users/");
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
    { modules: null },
    {},
    {
      modules: [
        {
          module_group_key: "settings",
          translates: [],
          modules: [{ key: "roles", translates: [] }],
        },
      ],
    },
    {
      modules: [
        {
          module_group_key: "settings",
          translates: [],
          modules: [{ key: "settings", link: "/settings", translates: [] }],
        },
      ],
    },
  ])(
    "returns home without mounting the route when its own module is not assigned",
    async (assignment) => {
      signIn();
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
        response(config, { roles: [], actions: [], ...assignment }),
      );
      mainInstance.defaults.adapter = adapter;
      renderRoute();
      expect(await screen.findByText("Home page")).toBeInTheDocument();
      expect(adapter).toHaveBeenCalledOnce();
      expect(screen.queryByText("Private control")).not.toBeInTheDocument();
    },
  );

  it("opens NodiaAI with its assigned module and no roles or actions", async () => {
    signIn();
    mainInstance.defaults.adapter = async (config) =>
      response(
        config,
        config.url?.endsWith("/authorization/context")
          ? {
              roles: [],
              actions: [],
              modules: [
                {
                  module_group_key: "tools",
                  translates: [],
                  modules: [
                    {
                      key: "nodia_ai",
                      link: "/nodia-ai",
                      translates: [],
                    },
                  ],
                },
              ],
            }
          : { data: [] },
      );
    renderRoute("/nodia-ai", "/nodia-ai");
    expect(await screen.findByText("Private control")).toBeInTheDocument();
  });

  it("does not grant NodiaAI navigation through an ordinary role or action without the module", async () => {
    signIn();
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
      response(config, {
        roles: ["admin"],
        actions: ["ai:manage"],
        modules: [],
      }),
    );
    mainInstance.defaults.adapter = adapter;
    const router = renderRoute("/nodia-ai?chat=42", "/nodia-ai");
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(router.state.historyAction).toBe("REPLACE");
    expect(adapter).toHaveBeenCalledOnce();
    expect(screen.queryByText("Private control")).not.toBeInTheDocument();
  });

  it("allows super_admin to open NodiaAI without module assignments or actions", async () => {
    signIn();
    mainInstance.defaults.adapter = async (config) =>
      response(
        config,
        config.url?.endsWith("/authorization/context")
          ? { roles: ["super_admin"], actions: [], modules: [] }
          : { data: [] },
      );
    renderRoute("/nodia-ai", "/nodia-ai");
    expect(await screen.findByText("Private control")).toBeInTheDocument();
  });

  it("keeps the page blocked after a context failure and allows retry", async () => {
    signIn();
    let fail = true;
    mainInstance.defaults.adapter = async (config) => {
      if (fail)
        throw new AxiosError(
          "Unavailable",
          "ERR_BAD_RESPONSE",
          config,
          undefined,
          {
            ...response(config, { message: "core:server_error_alert" }),
            status: 503,
          },
        );
      return response(
        config,
        config.url?.endsWith("/authorization/context") ? context : { data: [] },
      );
    };
    renderRoute();
    expect(await screen.findByRole("alert")).toHaveTextContent("Hubo un error");
    expect(screen.queryByText("Private control")).not.toBeInTheDocument();
    expect(sileo.error).toHaveBeenCalled();
    fail = false;
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Private control")).toBeInTheDocument();
  });

  it("preserves the authorized view while renewing and removes it if the assignment disappears", async () => {
    signIn();
    mainInstance.defaults.adapter = async (config) =>
      response(
        config,
        config.url?.endsWith("/authorization/context") ? context : { data: [] },
      );
    renderRoute();
    const control = await screen.findByText("Private control");
    act(() => { useAuthStore.getState().setRefreshing(true); useAuthStore.getState().setSessionStatus("restoring"); });
    expect(screen.getByText("Private control")).toBe(control);
    expect(control.closest("[inert]")).not.toBeNull();
    act(() => {
      queryClient.setQueryData([...authorizationKeys.context(), "42"], {
        ...context,
        modules: [],
      });
    });
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it.each(["restoring", "unavailable"] as const)("does not initially mount a cached authorized view while %s", status => {
    signIn();
    queryClient.setQueryData([...authorizationKeys.context(), "42"], context);
    useAuthStore.getState().setSessionStatus(status);
    const adapter = vi.fn(); mainInstance.defaults.adapter = adapter;
    renderRoute();
    expect(screen.queryByText("Private control")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAccessibleName("Validando tu sesión…");
    expect(adapter).not.toHaveBeenCalled();
  });

  it("requires an identified actor even if an unscoped authorization cache exists", () => {
    useAuthStore.getState().login({ token: "fixture", expiresAt: Date.now() + 900_000 });
    queryClient.setQueryData([...authorizationKeys.context(), undefined], context);
    const adapter = vi.fn(); mainInstance.defaults.adapter = adapter;
    renderRoute();
    expect(screen.queryByText("Private control")).not.toBeInTheDocument();
    expect(adapter).not.toHaveBeenCalled();
  });

  it("resets local page state for a replacement session and removes it on logout", async () => {
    signIn();
    mainInstance.defaults.adapter = async config => response(config, config.url?.endsWith("/authorization/context") ? context : { data: [] });
    renderRoute();
    const input = await screen.findByRole("textbox", { name: "Private draft" });
    fireEvent.change(input, { target: { value: "Prior session text" } });
    act(() => useAuthStore.setState(state => ({ sessionVersion: state.sessionVersion + 1 })));
    const replacement = screen.getByRole("textbox", { name: "Private draft" });
    expect(replacement).not.toBe(input); expect(replacement).toHaveValue("");
    act(() => useAuthStore.getState().logout());
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Private draft" })).not.toBeInTheDocument();
  });

  it("guards /business and /ai-providers using GuardStrict", async () => {
    signIn();
    const customContext = {
      roles: [],
      actions: [],
      modules: [
        {
          module_group_key: "negocios",
          translates: [],
          modules: [
            { key: "business", link: "/business", translates: [] },
          ],
        },
        {
          module_group_key: "settings",
          translates: [],
          modules: [
            {
              key: "ai_providers",
              link: "/ai-providers",
              translates: [],
            },
          ],
        },
      ],
    };

    const businessRouter = createMemoryRouter(
      [
        {
          path: "/business",
          element: (
            <GuardStrict modulePath="/business">
              <p>Business View</p>
            </GuardStrict>
          ),
        },
        { path: "/login", element: <p>Login page</p> },
        { path: "/404", element: <p>No access</p> },
      ],
      { initialEntries: ["/business"] },
    );

    mainInstance.defaults.adapter = async (config) =>
      response(config, customContext);
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={businessRouter} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Business View")).toBeInTheDocument();
  });
});
