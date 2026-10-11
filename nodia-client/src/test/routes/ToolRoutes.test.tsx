import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it, vi } from "vitest";
import router from "../../routes";
import { APP_AVAILABLE_ROUTES } from "../../routes/navigationOptions";

vi.mock("../../routes/GuardStrict", () => ({ default: ({ children, modulePath }: { children: ReactNode; modulePath: string }) => <section aria-label={modulePath}>{children}</section> }));
vi.mock("../../layouts/BaseLayout", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../modules/business/pages/Business", () => ({ default: () => <h1>Business list</h1> }));
vi.mock("../../modules/business/pages/BusinessDetail", () => ({ default: () => <h1>Business detail</h1> }));
vi.mock("../../modules/finances/pages/PersonalFinance", () => ({ default: () => <h1>Personal finances</h1> }));

describe("tools navigation routes", () => {
  it.each([
    ["/tools/business", "Business list", "/tools/business"],
    ["/tools/business/42", "Business detail", "/tools/business"],
    ["/tools/finances-personal", "Personal finances", "/tools/finances-personal"],
  ])("opens %s through the production router with the correct module", async (path, title, modulePath) => {
    const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
    render(<RouterProvider router={memory} />);
    expect(await screen.findByRole("heading", { name: title })).toBeVisible();
    expect(screen.getByRole("region", { name: modulePath })).toBeInTheDocument();
    memory.dispose();
  });
  it("offers the new paths in Modules and excludes the former paths", () => {
    const paths = APP_AVAILABLE_ROUTES.map(route => route.value);
    expect(paths).toContain("/tools/business"); expect(paths).toContain("/tools/finances-personal");
    expect(paths).not.toContain("/business"); expect(paths).not.toContain("/finances/personal");
  });
});
