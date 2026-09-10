import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PublicLayout from "../../../../src/layouts/PublicLayout";

vi.mock("../../../../src/components/LanguageSelector", () => ({
  default: () => <div data-testid="mock-language-selector">LanguageSelector</div>,
}));

vi.mock("../../../../src/components/ThemeSelector", () => ({
  default: () => <div data-testid="mock-theme-selector">ThemeSelector</div>,
}));

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
});
