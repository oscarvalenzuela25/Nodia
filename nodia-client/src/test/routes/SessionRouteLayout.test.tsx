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

describe("Public News session boundary", () => {
  it.each(["/news", "/news/"])("keeps %s readable during unavailable session and protects a later private destination", async (path) => {
    const router = createMemoryRouter([{ element: <SessionRouteLayout />, children: [
      { path: "/news", element: <input aria-label="Public filter" defaultValue="" /> },
      { path: "/private", element: <p>Private content</p> },
    ] }], { initialEntries: [path] });
    render(<RouterProvider router={router} />);
    const input = screen.getByRole("textbox", { name: "Public filter" });
    expect(input.closest("[inert]")).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(() => router.navigate("/private"));
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("does not extend the exemption to a News prefix lookalike", () => {
    const router = createMemoryRouter([{ element: <SessionRouteLayout />, children: [{ path: "/news/private", element: <p>Protected content</p> }] }], { initialEntries: ["/news/private"] });
    render(<RouterProvider router={router} />);
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });
});
