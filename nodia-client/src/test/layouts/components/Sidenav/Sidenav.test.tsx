import useAuthStore from "../../../../store/authStore";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import Sidenav from "../../../../../src/layouts/components/Sidenav/Sidenav";
import useGeneralSettingsStore from "../../../../../src/store/generalSettings/generalSettingsStore";

import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

describe("Sidenav", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    useAuthStore.getState().login({ token: "jwt", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Test" } });
    act(() => {
      useGeneralSettingsStore.getState().clearContext();
    });
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
                link: "/settings/users",
                translates: [
                  { key: "key", es: "Usuarios", en: "Users" },
                ],
              },
              {
                key: "roles",
                link: "/settings/roles",
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
});
