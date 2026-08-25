import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppErrorBoundary from "../../../../../modules/core/components/AppErrorBoundary";

const SensitiveFailure = () => {
  throw new Error("private backend detail");
};

describe("AppErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a translated generic fallback without exposing the error", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <SensitiveFailure />
      </AppErrorBoundary>
    );

    expect(
      screen.getByRole("heading", { name: "Error inesperado" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("La aplicacion encontro un problema.")
    ).toBeInTheDocument();
    expect(screen.queryByText("private backend detail")).not.toBeInTheDocument();
  });
});
