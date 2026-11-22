import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicLayout from "../../../../src/layouts/PublicLayout";
import { useConnectionStatus } from "../../../pwa/useConnectionStatus";
import useAuthStore from "../../../store/authStore";

vi.mock("../../../../src/components/LanguageSelector", () => ({
  default: () => <div data-testid="mock-language-selector">LanguageSelector</div>,
}));

vi.mock("../../../../src/components/ThemeSelector", () => ({
  default: () => <div data-testid="mock-theme-selector">ThemeSelector</div>,
}));
vi.mock("../../../pwa/useConnectionStatus", () => ({ useConnectionStatus: vi.fn(), retryConnection: vi.fn() }));
beforeEach(() => { vi.mocked(useConnectionStatus).mockReturnValue({ status: "available", checking: false }); });
afterEach(() => { useAuthStore.getState().logout(); });

describe("PublicLayout", () => {
  it("renders language selector, theme selector, and page content", () => {
    render(
      <PublicLayout>
        <div data-testid="test-content">Public Page Content</div>
      </PublicLayout>
    );

    expect(screen.getByTestId("mock-language-selector")).toBeInTheDocument();
    expect(screen.getByTestId("mock-theme-selector")).toBeInTheDocument();
    expect(screen.getByTestId("test-content")).toBeInTheDocument();
    expect(screen.getByText("Public Page Content")).toBeInTheDocument();
  });

  it("places the connection notice between public controls and the screen content", () => {
    vi.mocked(useConnectionStatus).mockReturnValue({ status: "offline", checking: false });
    render(<PublicLayout><main>Public route</main></PublicLayout>);
    const controls = screen.getByRole("banner");
    const notice = screen.getByRole("button", { name: "Reintentar conexión" }).closest("[data-connection-notice]");
    if (!notice) throw new Error("The retry button needs a connection notice");
    expect(controls.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notice.compareDocumentPosition(screen.getByRole("main")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("allows connection retry on a standalone route error even if the session was unavailable", () => {
    vi.mocked(useConnectionStatus).mockReturnValue({ status: "server-unavailable", checking: false });
    useAuthStore.getState().setSessionStatus("unavailable");
    render(<PublicLayout standalone><main>Error route</main></PublicLayout>);
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar conexión" })).toBeEnabled();
  });
});
