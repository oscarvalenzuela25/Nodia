import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Register from "../../../../../modules/auth/pages/Register";

const { login } = vi.hoisted(() => ({
  login: vi.fn(),
}));

vi.mock("../../../../../hooks/useAuth", () => ({
  default: () => ({ login }),
}));

describe("Register", () => {
  beforeEach(() => {
    login.mockClear();
  });

  it("creates the demo session and navigates home", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        { path: "/register", element: <Register /> },
        { path: "/", element: <div data-testid="destination" /> },
      ],
      { initialEntries: ["/register"] }
    );

    render(<RouterProvider router={router} />);
    await user.click(
      screen.getByRole("button", { name: "Registrarse (demo)" })
    );

    expect(login).toHaveBeenCalledWith({
      token: "demo-token",
      user: { name: "Demo User" },
    });
    expect(await screen.findByTestId("destination")).toBeInTheDocument();
  });
});
