import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import RouteError from "../../../../../modules/core/pages/RouteError";

describe("RouteError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a safe fallback instead of the original route error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const router = createMemoryRouter(
      [
        {
          path: "/",
          loader: () => {
            throw new Error("private route detail");
          },
          element: <div />,
          errorElement: <RouteError />,
        },
      ],
      { initialEntries: ["/"] }
    );

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { name: "Algo salio mal" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ocurrio un error inesperado.")
    ).toBeInTheDocument();
    expect(screen.queryByText("private route detail")).not.toBeInTheDocument();
  });
});
