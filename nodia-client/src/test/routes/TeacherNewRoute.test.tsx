import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { describe, expect, it, vi } from "vitest";
import router from "../../routes";

vi.mock("../../layouts/BaseLayout", () => ({ default: ({ children }: { children: ReactNode }) => children }));
vi.mock("../../routes/GuardStrict", () => ({ default: ({ children, modulePath }: { children: ReactNode; modulePath: string }) => <section aria-label={modulePath}>{children}</section> }));
vi.mock("../../modules/teacher/pages/TeacherNew", () => ({ default: () => <h1>New Teacher plan fixture</h1> }));
vi.mock("../../modules/teacher/pages/Teacher", () => ({ default: () => <h1>Teacher session fixture</h1> }));

describe("Teacher creation route", () => {
  it("matches new as a page and protects it with the canonical Teacher module", async () => {
    const memory = createMemoryRouter(router.routes, { initialEntries: ["/nodia-teacher/new"] });
    render(<RouterProvider router={memory} />);
    expect(await screen.findByRole("heading", { name: "New Teacher plan fixture" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "/nodia-teacher" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Teacher session fixture" })).not.toBeInTheDocument();
    memory.dispose();
  });
});
