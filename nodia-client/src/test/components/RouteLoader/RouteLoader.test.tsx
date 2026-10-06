import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RouteLoader from "../../../components/RouteLoader";

describe("RouteLoader", () => {
  it("renders page variant with circular progress and a visible status message", () => {
    render(<RouteLoader variant="page" />);

    const statusContainer = screen.getByRole("status");
    expect(statusContainer).toBeInTheDocument();
    expect(statusContainer).toHaveAttribute("aria-label", "Cargando página...");

    const progress = screen.getByRole("progressbar");
    expect(progress).toBeInTheDocument();
    expect(progress).toHaveAttribute("aria-label", "Cargando página...");
    expect(screen.getByText("Cargando página...")).toBeVisible();
  });

  it("renders fullscreen variant with circular progress and message", () => {
    render(<RouteLoader variant="fullscreen" />);

    const statusContainer = screen.getByRole("status");
    expect(statusContainer).toBeInTheDocument();
    expect(screen.getByText("Cargando página...")).toBeInTheDocument();

    const progress = screen.getByRole("progressbar");
    expect(progress).toBeInTheDocument();
  });

  it("renders custom message when messageKey or defaultMessage is provided", () => {
    render(
      <RouteLoader
        variant="fullscreen"
        defaultMessage="Cargando módulo de finanzas..."
      />
    );

    expect(screen.getByText("Cargando módulo de finanzas...")).toBeInTheDocument();
  });
});
