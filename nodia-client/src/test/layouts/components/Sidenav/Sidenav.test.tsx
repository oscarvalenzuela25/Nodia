import useAuthStore from "../../../../store/authStore";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Sidenav from "../../../../../src/layouts/components/Sidenav/Sidenav";
import useGeneralSettingsStore from "../../../../../src/store/generalSettings/generalSettingsStore";

import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import i18n from "../../../../translate";

// UI tests provide the current synthetic context explicitly. Actor/query
// isolation is exercised with the real transport in useVisibleModules tests.
vi.mock("../../../../services/authorizationService", () => ({
  useAuthorizationContext: () => ({ data: useGeneralSettingsStore() }),
}));

describe("Sidenav", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Test" } });
    act(() => {
      useGeneralSettingsStore.getState().clearContext();
    });
  });

  it("shows NodiaAI only after the ordinary user's current context assigns its module", async () => {
    const router = createMemoryRouter([{ path: "*", element: <Sidenav mobileOpen onDrawerToggle={vi.fn()} /> }]);
    render(<RouterProvider router={router} />);
    expect(screen.queryByRole("button", { name: "NodiaAI" })).not.toBeInTheDocument();
    act(() => useGeneralSettingsStore.getState().setContext({ roles: ["admin"], actions: [], modules: [{
      module_group_key: "tools", translates: [], modules: [{ key: "nodia_ai", link: "/nodia-ai",
        translates: [{ key: "key", es: "NodiaAI", en: "NodiaAI" }] }],
    }] }));
    expect(await screen.findByRole("button", { name: "NodiaAI" })).toBeVisible();
    act(() => useGeneralSettingsStore.getState().setContext({ roles: ["admin"], actions: [], modules: [] }));
    expect(screen.queryByRole("button", { name: "NodiaAI" })).not.toBeInTheDocument();
  });

  it.each([
    { language: "es", home: "Inicio", section: "Informes personalizados" },
    { language: "en", home: "Home", section: "Custom reports" },
  ])("identifies collapsed icons on hover and keeps keyboard navigation in $language", async ({ language, home, section }) => {
    const user = userEvent.setup();
    await act(async () => { await i18n.changeLanguage(language); });
    act(() => {
      useGeneralSettingsStore.getState().setContext({
        roles: [], actions: [], modules: [{
          module_group_key: "custom-group", translates: [], modules: [{
            key: "custom-reports", link: "/custom/reports",
            translates: [{ key: "key", es: "Informes personalizados", en: "Custom reports" }],
          }],
        }],
      });
    });
    const renderNavigation = (collapsed: boolean) => (
      <Sidenav mobileOpen onDrawerToggle={vi.fn()} desktopCollapsed={collapsed} />
    );
    const router = createMemoryRouter([{ path: "*", element: renderNavigation(true) }]);
    const view = render(<RouterProvider router={router} />);
    const homeIcon = screen.getByRole("button", { name: home });
    const sectionIcon = screen.getByRole("button", { name: section });

    await user.hover(sectionIcon);
    expect(await screen.findByRole("tooltip", { name: section })).toHaveTextContent(section);
    await user.unhover(sectionIcon);
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());

    await user.hover(homeIcon);
    expect(await screen.findByRole("tooltip", { name: home })).toHaveTextContent(home);
    await user.unhover(homeIcon);
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    await user.click(homeIcon);
    await user.unhover(homeIcon);
    await user.tab();
    expect(sectionIcon).toHaveFocus();
    // Native :focus-visible tooltip opening is verified in the browser QA.
    await user.keyboard("{Enter}");
    expect(router.state.location.pathname).toBe("/custom/reports");
    view.unmount();

    const expandedRouter = createMemoryRouter([{ path: "*", element: renderNavigation(false) }]);
    render(<RouterProvider router={expandedRouter} />);
    expect(screen.getByText(section)).toBeVisible();
    await user.hover(screen.getByRole("button", { name: section }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides administrative links for a visitor even if stale assignments remain in memory", () => {
    useAuthStore.getState().logout();
    useGeneralSettingsStore.getState().setContext({ roles: [], actions: [], modules: [{
      module_group_key: "settings", translates: [], modules: [{ key: "users", translates: [] }],
    }] });
    const router = createMemoryRouter([{ path: "/", element: <Sidenav mobileOpen onDrawerToggle={vi.fn()} /> }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.queryByText("users")).not.toBeInTheDocument();
    expect(screen.queryByText("Ajustes Generales")).not.toBeInTheDocument();
  });

  it("should render Inicio by default when store is empty without dummy modules", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <Sidenav
              mobileOpen={true}
              onDrawerToggle={vi.fn()}
              desktopCollapsed={false}
            />
          ),
        },
      ],
      { initialEntries: ["/"] }
    );

    render(<RouterProvider router={router} />);

    // Check for logo title
    expect(screen.getByRole("heading", { name: "Nodia" })).toBeInTheDocument();

    // Inicio is ALWAYS present by default
    expect(screen.getByText("Inicio")).toBeInTheDocument();

    // No hardcoded module groups when store is empty
    expect(screen.queryByText("Ajustes Generales")).not.toBeInTheDocument();
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
  });

  it("should render dynamic module groups and toggle collapsible submodules when populated in store", async () => {
    const user = userEvent.setup();

    act(() => {
      useGeneralSettingsStore.getState().setContext({
        roles: ["admin"],
        actions: [],
        modules: [
          {
            module_group_key: "ajustes-generales",
            translates: [
              { key: "key", es: "Ajustes Generales", en: "General Settings" },
            ],
            modules: [
              {
                key: "usuarios",
                link: "/users",
                translates: [
                  { key: "key", es: "Usuarios", en: "Users" },
                ],
              },
              {
                key: "roles",
                link: "/roles",
                translates: [
                  { key: "key", es: "Roles", en: "Roles" },
                ],
              },
            ],
          },
        ],
      });
    });

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <Sidenav
              mobileOpen={true}
              onDrawerToggle={vi.fn()}
              desktopCollapsed={false}
            />
          ),
        },
      ],
      { initialEntries: ["/"] }
    );

    render(<RouterProvider router={router} />);

    // Inicio is ALWAYS present by default
    expect(screen.getByText("Inicio")).toBeInTheDocument();

    for (const list of screen.getAllByRole("list")) {
      expect([...list.children].every((child) => child.tagName === "LI")).toBe(true);
    }

    // Check for module group header
    const moduleHeader = screen.getByText("Ajustes Generales");
    expect(moduleHeader).toBeInTheDocument();

    // Submodules initially visible
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Roles")).toBeInTheDocument();

    // Click module header to collapse
    await user.click(moduleHeader);

    // After collapsing, submodules are unmounted from DOM (unmountOnExit)
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();

    // Click module header again to expand
    await user.click(moduleHeader);
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
  });

  it("should render dynamic module groups and submodules with custom paths", async () => {
    act(() => {
      useGeneralSettingsStore.getState().setContext({
        roles: ["admin"],
        actions: [],
        modules: [
          {
            module_group_key: "custom-group",
            translates: [
              { key: "key", es: "Grupo Personalizado", en: "Custom Group" },
            ],
            modules: [
              {
                key: "custom-module",
                link: "/custom/path",
                translates: [
                  { key: "key", es: "Módulo Custom", en: "Custom Module" },
                ],
              },
            ],
          },
        ],
      });
    });

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <Sidenav
              mobileOpen={true}
              onDrawerToggle={vi.fn()}
              desktopCollapsed={false}
            />
          ),
        },
      ],
      { initialEntries: ["/"] }
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.getByText("Grupo Personalizado")).toBeInTheDocument();
    expect(screen.getByText("Módulo Custom")).toBeInTheDocument();
  });

  it("preserves server group and module order instead of prioritizing names", () => {
    act(() => {
      useGeneralSettingsStore.getState().setContext({
        roles: ["admin"],
        actions: [],
        modules: [
          {
            module_group_key: "general_settings",
            translates: [
              { key: "key", es: "Ajustes Generales", en: "General Settings" },
            ],
            modules: [
              { key: "roles", link: "/roles", translates: [{ key: "key", es: "Roles primero", en: "Roles first" }] },
              {
                key: "users",
                link: "/users",
                translates: [{ key: "key", es: "Usuarios", en: "Users" }],
              },
            ],
          },
          {
            module_group_key: "business",
            translates: [
              { key: "key", es: "Negocios", en: "Business" },
            ],
            modules: [
              {
                key: "businesses",
                link: "/business",
                translates: [{ key: "key", es: "Mis Negocios", en: "My Businesses" }],
              },
            ],
          },
        ],
      });
    });

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <Sidenav
              mobileOpen={true}
              onDrawerToggle={vi.fn()}
              desktopCollapsed={false}
            />
          ),
        },
      ],
      { initialEntries: ["/"] }
    );

    render(<RouterProvider router={router} />);

    const businessHeader = screen.getByText("Negocios");
    const settingsHeader = screen.getByText("Ajustes Generales");

    expect(businessHeader).toBeInTheDocument();
    expect(settingsHeader).toBeInTheDocument();

    // The server supplied Settings first; names must not override that order.
    expect(
      Boolean(
        settingsHeader.compareDocumentPosition(businessHeader) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);
    expect(screen.getByText("Roles primero").compareDocumentPosition(screen.getByText("Usuarios"))
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders clickable submodules with a padding-left of 24px", () => {
    act(() => {
      useGeneralSettingsStore.getState().setContext({
        roles: ["admin"],
        actions: [],
        modules: [
          {
            module_group_key: "ajustes-generales",
            translates: [
              { key: "key", es: "Ajustes Generales", en: "General Settings" },
            ],
            modules: [
              {
                key: "usuarios",
                link: "/users",
                translates: [{ key: "key", es: "Usuarios", en: "Users" }],
              },
            ],
          },
        ],
      });
    });

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <Sidenav
              mobileOpen={true}
              onDrawerToggle={vi.fn()}
              desktopCollapsed={false}
            />
          ),
        },
      ],
      { initialEntries: ["/"] }
    );

    render(<RouterProvider router={router} />);

    const usersText = screen.getByText("Usuarios");
    const moduleButton = usersText.closest("div[role='button']");
    expect(moduleButton).toBeInTheDocument();
    expect(moduleButton).toHaveStyle({ paddingLeft: "24px" });
  });

  it("calls onDrawerToggle when a navigation item is clicked on mobile", async () => {
    const user = userEvent.setup();
    const handleDrawerToggle = vi.fn();

    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: (
            <Sidenav
              mobileOpen={true}
              onDrawerToggle={handleDrawerToggle}
              desktopCollapsed={false}
            />
          ),
        },
      ],
      { initialEntries: ["/"] }
    );

    render(<RouterProvider router={router} />);

    const homeItem = screen.getByText("Inicio");
    await user.click(homeItem);

    expect(handleDrawerToggle).toHaveBeenCalledTimes(1);
  });
});

