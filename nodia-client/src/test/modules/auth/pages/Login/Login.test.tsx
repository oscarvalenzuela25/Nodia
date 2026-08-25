import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "../../../../../modules/auth/pages/Login";

const { login } = vi.hoisted(() => ({
  login: vi.fn(),
}));

vi.mock("../../../../../hooks/useAuth", () => ({
  default: () => ({ login }),
}));

describe("Login", () => {
  beforeEach(() => {
    login.mockClear();
  });

  it("starts the demo session and navigates home", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        { path: "/login", element: <Login /> },
        { path: "/", element: <div data-testid="destination" /> },
      ],
      { initialEntries: ["/login"] }
    );

    render(<RouterProvider router={router} />);
    await user.click(
      screen.getByRole("button", { name: "Iniciar sesion (demo)" })
    );

    expect(login).toHaveBeenCalledWith({
      token: "demo-token",
      user: { name: "Demo User" },
    });
    expect(await screen.findByTestId("destination")).toBeInTheDocument();
  });
});
