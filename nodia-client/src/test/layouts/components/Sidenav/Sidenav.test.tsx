import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Sidenav from "../../../../../src/layouts/components/Sidenav/Sidenav";

import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

describe("Sidenav", () => {
  it("should render mock menu items correctly", () => {
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
    
    // Check for logo
    expect(screen.getByAltText("Nodia Logo")).toBeInTheDocument();

    // Check for single module item
    expect(screen.getByText("Inicio")).toBeInTheDocument();

    // Check for module with submodules (header)
    expect(screen.getByText("Ajustes Generales")).toBeInTheDocument();

    // Check for submodules
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Roles")).toBeInTheDocument();
    expect(screen.getByText("Módulos")).toBeInTheDocument();
    expect(screen.getByText("Recursos")).toBeInTheDocument();
  });
});
