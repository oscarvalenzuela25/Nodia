import { act, render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SessionRouteLayout from "../../routes/SessionRouteLayout";
import useAuthStore from "../../store/authStore";

vi.mock("../../config/api", () => ({ refreshSession: vi.fn(), restoreSession: vi.fn(() => new Promise(() => {})) }));
vi.mock("../../modules/auth/infrastructure/useServices", () => ({ useSignOut: () => ({ mutate: vi.fn(), isPending: false }) }));
beforeEach(() => { useAuthStore.getState().logout(); useAuthStore.getState().login({ token: "synthetic-stored", expiresAt: Date.now() + 900_000, user: { id: "42", name: "Synthetic actor" } }); useAuthStore.getState().setSessionStatus("unavailable"); });
afterEach(() => useAuthStore.getState().logout());

describe("Personal News session boundary", () => {
  it.each(["/news", "/news/"])("waits for a validated session before rendering %s", (path) => {
    const router = createMemoryRouter([{
      element: <SessionRouteLayout />,
      children: [{ path: "/news", element: <p>Personal news content</p> }],
    }], { initialEntries: [path] });
    render(<RouterProvider router={router} />);

    expect(screen.queryByText("Personal news content")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeVisible();

    act(() => useAuthStore.getState().setSessionStatus("authenticated"));
    expect(screen.getByText("Personal news content")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("also protects a nested News destination during a session outage", () => {
    const router = createMemoryRouter([{ element: <SessionRouteLayout />, children: [{ path: "/news/private", element: <p>Protected content</p> }] }], { initialEntries: ["/news/private"] });
    render(<RouterProvider router={router} />);
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
});
