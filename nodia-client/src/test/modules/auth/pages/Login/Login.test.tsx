import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "../../../../../modules/auth/pages/Login";

import PublicLayout from "../../../../../layouts/PublicLayout";

const { login } = vi.hoisted(() => ({
  login: vi.fn(),
}));

vi.mock("../../../../../hooks/useAuth", () => ({
  default: () => ({ login }),
}));

vi.mock("@react-oauth/google", () => ({
  useGoogleLogin: (options: { onSuccess?: (response: unknown) => void }) => () => {
    if (options.onSuccess) {
      options.onSuccess({ access_token: "mock-google-token" });
    }
  },
}));

describe("Login", () => {
  beforeEach(() => {
    login.mockClear();
  });

  it("starts the demo session and navigates home", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        {
          path: "/login",
          element: (
            <PublicLayout>
              <Login />
            </PublicLayout>
          ),
        },
        { path: "/", element: <div data-testid="destination" /> },
      ],
      { initialEntries: ["/login"] }
    );

    render(<RouterProvider router={router} />);
    await user.click(
      screen.getByRole("button", { name: /google/i })
    );

    expect(login).toHaveBeenCalledWith({
      token: "demo-token",
      user: { name: "Demo User" },
    });
    expect(await screen.findByTestId("destination")).toBeInTheDocument();
  });

  it("renders Nodia typography logo and language selector", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/login",
          element: (
            <PublicLayout>
              <Login />
            </PublicLayout>
          ),
        },
      ],
      { initialEntries: ["/login"] }
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByText("Nodia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cambiar idioma|toggle_language/i })).toBeInTheDocument();
  });

  it("navigates to home when clicking back to home button", async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter(
      [
        {
          path: "/login",
          element: (
            <PublicLayout>
              <Login />
            </PublicLayout>
          ),
        },
        { path: "/", element: <div data-testid="home-destination" /> },
      ],
      { initialEntries: ["/login"] }
    );

    render(<RouterProvider router={router} />);
    const backBtn = screen.getByRole("button", { name: /volver al inicio|back to home/i });
    expect(backBtn).toBeInTheDocument();

    await user.click(backBtn);
    expect(await screen.findByTestId("home-destination")).toBeInTheDocument();
  });
});
