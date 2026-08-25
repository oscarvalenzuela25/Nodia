import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ThemeSelector from "../../../../../src/layouts/components/ThemeSelector/ThemeSelector";
import useThemeStore from "../../../../../src/store/configStore";

vi.mock("../../../../../src/store/configStore", () => ({
  __esModule: true,
  default: vi.fn(),
}));

describe("ThemeSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render light mode icon when theme is light", () => {
    vi.mocked(useThemeStore).mockReturnValue({
      themeType: "light",
      handleToggleThemeType: vi.fn(),
      handleChangeThemeType: vi.fn(),
    });

    render(<ThemeSelector />);
    const checkbox = screen.getByRole("checkbox", { hidden: true });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  it("should render dark mode icon when theme is dark", () => {
    vi.mocked(useThemeStore).mockReturnValue({
      themeType: "dark",
      handleToggleThemeType: vi.fn(),
      handleChangeThemeType: vi.fn(),
    });

    render(<ThemeSelector />);
    const checkbox = screen.getByRole("checkbox", { hidden: true });
    expect(checkbox).not.toBeChecked();
  });

  it("should call handleToggleThemeType when clicked", async () => {
    const handleToggleThemeType = vi.fn();
    vi.mocked(useThemeStore).mockReturnValue({
      themeType: "light",
      handleToggleThemeType,
      handleChangeThemeType: vi.fn(),
    });

    const user = userEvent.setup();
    render(<ThemeSelector />);
    
    const label = screen.getByLabelText("Cambiar tema");
    await user.click(label);

    expect(handleToggleThemeType).toHaveBeenCalledTimes(1);
  });
});
