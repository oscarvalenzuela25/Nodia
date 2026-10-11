import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import router from "../../routes";
import { mainInstance } from "../../config/api";
import { queryClient } from "../../config/reactQuery";
import useAuthStore from "../../store/authStore";
import { authorizationKeys } from "../../services/authorizationService";
import { useUsers } from "../../modules/generalSettings/pages/Users/infrastructure/useServices";

// Keep the production route composition and layout; isolate unrelated shell data.
vi.mock("../../layouts/components/Sidenav", () => ({
  default: () => <aside>Navigation</aside>,
}));
vi.mock("../../layouts/components/Topbar", () => ({
  default: () => <header>Application header</header>,
}));
vi.mock("../../layouts/components/MobileBottomNav", () => ({
  default: () => <nav>Mobile navigation</nav>,
}));
vi.mock("sileo", () => ({ sileo: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../modules/generalSettings/pages/Users", () => ({
  default: function UsersProbe() {
    useUsers();
    return <input aria-label="Unsaved draft" defaultValue="" />;
  },
}));

const originalAdapter = mainInstance.defaults.adapter;
const contextKey = [...authorizationKeys.context(), "notice-test"];
const context = {
  roles: [],
  actions: [],
  modules: [
    {
      module_group_key: "settings",
      translates: [],
      modules: [{ key: "users", link: "/settings/users", translates: [] }],
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
function unavailable(config: InternalAxiosRequestConfig): never {
  throw new AxiosError("Unavailable", "ERR_BAD_RESPONSE", config, undefined, {
    ...response(config, { message: "core:server_error_alert" }),
    status: 503,
  });
}
let memoryRouter: ReturnType<typeof createMemoryRouter>;
function openRoute(path: string) {
  memoryRouter = createMemoryRouter(router.routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={memoryRouter} />
    </QueryClientProvider>,
  );
}
function expectNoticeInContent() {
  const header = screen.getByRole("banner");
  const alert = screen.getByRole("alert");
  expect(alert.closest("main")).toBe(header.closest("main"));
  expect(alert.closest("main")).not.toBeNull();
  expect(
    header.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(alert).toHaveTextContent("Hubo un error");
}
beforeEach(() => {
  queryClient.clear();
  useAuthStore.getState().logout();
  useAuthStore
    .getState()
    .login({
      token: "synthetic",
      expiresAt: Date.now() + 900_000,
      user: { id: "notice-test", name: "Test" },
    });
});
afterEach(() => {
  memoryRouter?.dispose();
  queryClient.clear();
  useAuthStore.getState().logout();
  mainInstance.defaults.adapter = originalAdapter;
});

describe("authorization notices in production routes", () => {
  it.each([
    "/tools/reservations",
    "/tools/finances-personal",
    "/tools/business",
    "/tools/business/1",
    "/settings/users",
    "/settings/roles",
    "/settings/actions",
    "/settings/modules",
    "/settings/ai-providers",
  ])(
    "retains the header and shows an initial failure in content on %s",
    async (path) => {
      const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
        unavailable(config),
      );
      mainInstance.defaults.adapter = adapter;
      openRoute(path);
      await screen.findByRole("alert");
      expectNoticeInContent();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(adapter).toHaveBeenCalledOnce();
      expect(adapter.mock.calls[0][0].url).toContain("/authorization/context");
    },
  );

  it("keeps the shell during a failed retry and mounts page data only after recovery", async () => {
    let fail = true;
    let finishRetry: (() => void) | undefined;
    let pause = false;
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      if (config.url?.endsWith("/authorization/context")) {
        if (pause)
          await new Promise<void>((resolve) => {
            finishRetry = resolve;
          });
        if (fail) return unavailable(config);
        return response(config, context);
      }
      return response(config, { data: [] });
    });
    mainInstance.defaults.adapter = adapter;
    openRoute("/settings/users");
    await screen.findByRole("alert");
    const header = screen.getByRole("banner");
    pause = true;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(finishRetry).toBeDefined());
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDisabled();
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await act(async () => finishRetry!());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled(),
    );
    expectNoticeInContent();
    expect(
      adapter.mock.calls.every(([config]) =>
        config.url?.endsWith("/authorization/context"),
      ),
    ).toBe(true);
    pause = false;
    fail = false;
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(
      await screen.findByRole("textbox", { name: "Unsaved draft" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        adapter.mock.calls.some(([config]) => config.url?.endsWith("/users")),
      ).toBe(true),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("banner")).toBe(header);
  });

  it("preserves an unsaved view on refresh failure and unblocks it after retry", async () => {
    let fail = false;
    mainInstance.defaults.adapter = async (config) => {
      if (config.url?.endsWith("/authorization/context")) {
        if (fail) return unavailable(config);
        return response(config, context);
      }
      return response(config, { data: [] });
    };
    openRoute("/settings/users");
    const draft = await screen.findByRole("textbox", { name: "Unsaved draft" });
    const user = userEvent.setup();
    await user.type(draft, "Keep this draft");
    fail = true;
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: contextKey, exact: true });
    });
    await screen.findByRole("alert");
    expectNoticeInContent();
    expect(screen.getByRole("textbox")).toBe(draft);
    expect(draft).toHaveValue("Keep this draft");
    expect(draft.closest("[inert]")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Reintentar" }).closest("[inert]"),
    ).toBeNull();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("textbox")).toBe(draft);
    expect(draft).toHaveValue("Keep this draft");
    expect(draft.closest("[inert]")).toBeNull();
  });
});
