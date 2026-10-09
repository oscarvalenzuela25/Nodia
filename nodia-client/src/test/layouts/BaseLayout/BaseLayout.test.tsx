import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import useAuthStore from "../../../store/authStore";
import BaseLayout from "../../../../src/layouts/BaseLayout/BaseLayout";


// Mock the components inside BaseLayout so we don't have to deal with their dependencies (like ThemeStore)
vi.mock("../../../../src/layouts/components/Sidenav", () => ({
  __esModule: true,
  default: () => <div data-testid="mock-sidenav">Sidenav</div>,
}));

vi.mock("../../../../src/layouts/components/Topbar", () => ({
  __esModule: true,
  default: () => <div data-testid="mock-topbar">Topbar</div>,
}));
vi.mock("../../../../src/layouts/components/MobileBottomNav", () => ({ default: () => <nav data-testid="mock-mobile-nav" /> }));
afterEach(() => { vi.restoreAllMocks(); useAuthStore.getState().logout(); });

describe("BaseLayout", () => {
  it("mounts the bottom navigation only on an authenticated mobile screen", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: query.includes("max-width:599.95px"), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    useAuthStore.getState().login({ token: "synthetic", user: { id: "a", name: "A" }, expiresAt: Date.now() + 900_000 });
    render(<BaseLayout>Mobile</BaseLayout>);
    expect(screen.getByTestId("mock-mobile-nav")).toBeInTheDocument();
  });
  it("does not mount navigation for an anonymous mobile visitor", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(query => ({ matches: query.includes("max-width:599.95px"), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    useAuthStore.getState().logout(); render(<BaseLayout>Visitor</BaseLayout>);
    expect(screen.queryByTestId("mock-mobile-nav")).not.toBeInTheDocument();
  });
  it("should render Sidenav, Topbar and children", () => {
    render(
      <BaseLayout>
        <div data-testid="mock-children">Test Content</div>
      </BaseLayout>
    );

    expect(screen.getByTestId("mock-sidenav")).toBeInTheDocument();
    expect(screen.getByTestId("mock-topbar")).toBeInTheDocument();
    expect(screen.getByTestId("mock-children")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });
});
