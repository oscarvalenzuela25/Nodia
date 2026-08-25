import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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

describe("BaseLayout", () => {
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
