import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import useAuthStore from "../../../store/authStore";
import BaseLayout from "../../../../src/layouts/BaseLayout/BaseLayout";
import { retryConnection, useConnectionStatus } from "../../../pwa/useConnectionStatus";


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
vi.mock("../../../pwa/PwaUpdateNotice", () => ({ default: () => <div data-testid="mock-pwa-update" /> }));
vi.mock("../../../pwa/useConnectionStatus", () => ({ useConnectionStatus: vi.fn(), retryConnection: vi.fn() }));
beforeEach(() => { vi.mocked(useConnectionStatus).mockReturnValue({ status: "available", checking: false }); });
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

  it("shows one server notice in main flow between Topbar and the PWA update, with retry still available", () => {
    vi.mocked(useConnectionStatus).mockReturnValue({ status: "server-unavailable", checking: false });
    render(<BaseLayout><div data-testid="route-content" /></BaseLayout>);
    const main = screen.getByRole("main");
    const button = within(main).getByRole("button", { name: "Reintentar conexión" });
    const notice = button.closest("[data-connection-notice]");
    if (!notice) throw new Error("The retry button needs a connection notice");
    const topbar = within(main).getByTestId("mock-topbar");
    const update = within(main).getByTestId("mock-pwa-update");
    const content = within(main).getByTestId("route-content");
    expect(notice.parentElement).toBe(main);
    expect(topbar.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(update) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(update.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Reintentar conexión" })).toHaveLength(1);
    fireEvent.click(button);
    expect(retryConnection).toHaveBeenCalledOnce();
  });

  it("keeps the status visible without another retry control when the session shell is retained inert", () => {
    vi.mocked(useConnectionStatus).mockReturnValue({ status: "offline", checking: false });
    useAuthStore.getState().login({ token: "synthetic", user: { id: "a", name: "A" }, expiresAt: Date.now() + 900_000 });
    useAuthStore.getState().setSessionStatus("unavailable");
    render(<BaseLayout>Retained content</BaseLayout>);
    expect(screen.getByRole("main").querySelector("[data-connection-notice]")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reintentar conexión" })).not.toBeInTheDocument();
  });
});
