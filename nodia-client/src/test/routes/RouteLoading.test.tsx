import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link } from "react-router";
import { RouterProvider } from "react-router/dom";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import router from "../../routes";

const usersImport = vi.hoisted(() => {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
});

vi.mock("../../routes/Guard", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../routes/GuardStrict", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../layouts/BaseLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <><aside>Navigation menu</aside><header>App header</header><main>{children}</main></>,
}));
vi.mock("../../modules/business/pages/Business", () => ({
  default: () => <><h1>Businesses page</h1><Link to="/settings/users">Open users</Link></>,
}));
vi.mock("../../modules/generalSettings/pages/Users", async () => {
  await usersImport.promise;
  return { default: () => <><h1>Users page</h1><Link to="/business">Go back</Link></> };
});

describe("production lazy route navigation", () => {
  it("shows loading immediately while the new chunk waits and keeps the navigation shell", async () => {
    const user = userEvent.setup();
    const testRouter = createMemoryRouter(router.routes, { initialEntries: ["/business"] });
    render(<RouterProvider router={testRouter} />);
    await screen.findByRole("heading", { name: "Businesses page" });
    await user.click(screen.getByRole("link", { name: "Open users" }));

    try {
      expect(await screen.findByRole("status", { name: "Cargando página..." })).toBeVisible();
      expect(screen.getByRole("progressbar")).toBeVisible();
      expect(screen.getByText("Navigation menu")).toBeVisible();
      expect(screen.getByText("App header")).toBeVisible();
    } finally {
      await act(async () => { usersImport.resolve(); });
    }

    expect(await screen.findByRole("heading", { name: "Users page" })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Go back" }));
    await screen.findByRole("heading", { name: "Businesses page" });
    await user.click(screen.getByRole("link", { name: "Open users" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Users page" })).toBeVisible());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    testRouter.dispose();
  });
});
