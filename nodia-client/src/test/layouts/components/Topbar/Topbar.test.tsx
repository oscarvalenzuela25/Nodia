import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import Topbar from "../../../../../src/layouts/components/Topbar/Topbar";
import useThemeStore from "../../../../../src/store/configStore";

vi.mock("../../../../../src/store/configStore", () => ({
  __esModule: true,
  default: vi.fn(),
}));

describe("Topbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render Topbar with ThemeSelector and Avatar", () => {
    vi.mocked(useThemeStore).mockReturnValue({
      themeType: "light",
      handleToggleThemeType: vi.fn(),
      handleChangeThemeType: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Topbar
          onDrawerToggle={vi.fn()}
          desktopCollapsed={false}
          onCollapseToggle={vi.fn()}
        />
      </MemoryRouter>
    );
    
    // Theme selector should be there
    expect(screen.getByLabelText("Cambiar tema")).toBeInTheDocument();
    
    // Login button since isLogged is false
    expect(screen.getByText("Ingresar")).toBeInTheDocument();
  });
});
