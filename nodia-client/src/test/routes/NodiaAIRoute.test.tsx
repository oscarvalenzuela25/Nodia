import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import router from "../../routes";
import useAuthStore from "../../store/authStore";
import { mainInstance } from "../../config/api";
import { queryClient } from "../../config/reactQuery";
import { NODIA_AI_ROUTE } from "../../modules/nodiaAi/constants/routes";
import { APP_AVAILABLE_ROUTES } from "../../modules/generalSettings/pages/Modules/constants/routes";
import i18n from "../../translate";

vi.mock("../../layouts/BaseLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
const originalAdapter = mainInstance.defaults.adapter;
const nodiaRoute = router.routes[0].children?.find(route => route.path === NODIA_AI_ROUTE);
// This smoke verifies the real route, authority, language and GET-only admission.
// Resolve its real module before assertions; cold transform time is not an auth deadline.
beforeAll(async () => { await import("../../modules/nodiaAi/pages/NodiaAI"); });
function openRoute() {
  if (!nodiaRoute) throw new Error("Missing NodiaAI route");
  const testRouter = createMemoryRouter([
    nodiaRoute,
    { path: "/login", element: <p>Sign in</p> },
    { path: "/", element: <p>Home page</p> },
  ], { initialEntries: [NODIA_AI_ROUTE] });
  render(<QueryClientProvider client={queryClient}><RouterProvider router={testRouter} /></QueryClientProvider>);
}
function adapter(assigned: boolean, roles: string[] = []) {
  const transport = vi.fn(async config => ({
    config,
    data: config.url?.includes("/nodia-ai/") ? { items: [], next_cursor: null } : { roles, actions: [], modules: assigned ? [{ module_group_key: "tools", translates: [],
      modules: [{ key: "nodia_ai", link: NODIA_AI_ROUTE, translates: [] }] }] : [] },
    status: 200, statusText: "OK", headers: {},
  }));
  mainInstance.defaults.adapter = transport;
  return transport;
}
beforeEach(async () => {
  queryClient.clear(); useAuthStore.getState().logout(); await i18n.changeLanguage("es");
});
afterEach(() => {
  queryClient.clear(); useAuthStore.getState().logout(); mainInstance.defaults.adapter = originalAdapter;
});
describe("NodiaAI route", () => {
  it("appears once in the translated administrative route catalog", () => {
    const routes = APP_AVAILABLE_ROUTES.filter(route => route.value === NODIA_AI_ROUTE);
    expect(routes).toHaveLength(1);
    expect(i18n.t(routes[0].labelKey)).toBe("NodiaAI");
  });
  it("redirects anonymous visitors before any HTTP request", async () => {
    const transport = adapter(true); openRoute();
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([{ roles: [] }, { roles: ["admin"] }])("requires the module for ordinary roles $roles", async ({ roles }) => {
    useAuthStore.getState().login({ token: "fixture", expiresAt: Date.now() + 900000, user: { id: "1", name: "Fixture" } });
    adapter(false, roles); openRoute();
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });
  it("does not mount chat from a differently identified module pointing to its URL", async () => {
    useAuthStore.getState().login({ token: "fixture", expiresAt: Date.now() + 900000, user: { id: "1", name: "Fixture" } });
    const transport = vi.fn(async config => ({ config, status: 200, statusText: "OK", headers: {},
      data: { roles: [], actions: [], modules: [{ module_group_key: "tools", translates: [],
        modules: [{ key: "other_module", link: NODIA_AI_ROUTE, translates: [] }] }] } }));
    mainInstance.defaults.adapter = transport;
    openRoute();
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(transport.mock.calls.every(([config]) => config.url?.includes("/authorization/context"))).toBe(true);
  });
  it.each(["es", "en"])("opens the assigned page in %s with read-only coordination requests and no inference", async language => {
    await i18n.changeLanguage(language);
    useAuthStore.getState().login({ token: "fixture", expiresAt: Date.now() + 900000, user: { id: "1", name: "Fixture" } });
    const transport = adapter(true); openRoute();
    expect(await screen.findByRole("heading", { name: "Nodia AI", level: 1 })).toBeInTheDocument();
    expect(await screen.findByText(i18n.t("nodiaAi:welcome_message"))).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(transport.mock.calls.every(([config]) => config.method === "get")).toBe(true);
    expect(transport.mock.calls[0][0].url).toContain("/authorization/context");
  });
});
