import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import Sidenav from "../../../../../src/layouts/components/Sidenav/Sidenav";

import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

describe("Sidenav", () => {
  it("should render mock menu items correctly and toggle collapsible submodules", async () => {
    const user = userEvent.setup();
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

    // Check for single module item
    expect(screen.getByText("Inicio")).toBeInTheDocument();

    // Check for module with submodules (header button)
    const moduleHeader = screen.getByText("Ajustes Generales");
    expect(moduleHeader).toBeInTheDocument();

    // Submodules initially visible
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Roles")).toBeInTheDocument();
    expect(screen.getByText("Acciones")).toBeInTheDocument();
    expect(screen.getByText("Módulos")).toBeInTheDocument();

    // Click module header to collapse
    await user.click(moduleHeader);

    // After collapsing, submodules are unmounted from DOM (unmountOnExit)
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();

    // Click module header again to expand
    await user.click(moduleHeader);
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
  });
});
