import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router";
import Breadcrumb from "../../../../src/components/Breadcrumb";
import MUIProvider from "../../../../src/providers/MUIProvider";

describe("Breadcrumb Component", () => {
  it("renders breadcrumb links and current item correctly", () => {
    render(
      <MemoryRouter>
        <MUIProvider>
          <Breadcrumb
            items={[
              { label: "Negocios", to: "/business" },
              { label: "Detalle de Empresa" },
            ]}
          />
        </MUIProvider>
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: "Negocios" });
    expect(link).toHaveAttribute("href", "/business");

    const current = screen.getByText("Detalle de Empresa");
    expect(current).toBeInTheDocument();
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("renders extra slot if provided", () => {
    render(
      <MemoryRouter>
        <MUIProvider>
          <Breadcrumb
            items={[{ label: "Inicio", to: "/" }, { label: "Configuración" }]}
            extra={<span data-testid="sync-badge">Sync en vivo</span>}
          />
        </MUIProvider>
      </MemoryRouter>
    );

    expect(screen.getByTestId("sync-badge")).toBeInTheDocument();
  });
});
