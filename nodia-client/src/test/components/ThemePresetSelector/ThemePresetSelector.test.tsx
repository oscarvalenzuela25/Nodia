import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import ThemePresetSelector from "../../../components/ThemePresetSelector";
import useThemeStore from "../../../store/configStore";
import { DEFAULT_THEME_ID, themePresets } from "../../../themes";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

const defaultChangeTheme = useThemeStore.getState().handleChangeThemeId;
const alternative = themePresets.find((preset) => preset.id !== DEFAULT_THEME_ID)!;

beforeEach(() => {
  vi.clearAllMocks();
  useThemeStore.setState({
    themeId: DEFAULT_THEME_ID,
    themeType: "dark",
    handleChangeThemeId: defaultChangeTheme,
  });
});

describe("ThemePresetSelector", () => {
  it("searches and applies a theme with keyboard while preserving dark mode and restoring focus", async () => {
    const user = userEvent.setup();
    render(<ThemePresetSelector />);
    const trigger = screen.getByRole("button", { name: "Elegir tema: Nodia" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const search = screen.getByRole("combobox", { name: "Buscar un tema" });
    expect(search).toHaveFocus();
    expect(screen.getByRole("option", { name: "Nodia" })).toHaveAttribute("aria-selected", "true");
    await user.type(search, alternative.name);
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(useThemeStore.getState().themeId).toBe(alternative.id);
    expect(useThemeStore.getState().themeType).toBe("dark");
    expect(sileo.success).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByRole("option", { name: alternative.name })).toHaveAttribute("aria-selected", "true");
  });

  it("closes the current theme without duplicate state changes or notifications", async () => {
    const user = userEvent.setup();
    const changeTheme = vi.fn();
    useThemeStore.setState({ handleChangeThemeId: changeTheme });
    render(<ThemePresetSelector />);
    await user.click(screen.getByRole("button", { name: "Elegir tema: Nodia" }));
    await user.click(screen.getByRole("option", { name: "Nodia" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(changeTheme).not.toHaveBeenCalled();
    expect(sileo.success).not.toHaveBeenCalled();
  });

  it("reports a search with no matches, preserves selection across resize and cancels with Escape", async () => {
    const user = userEvent.setup();
    render(<ThemePresetSelector />);
    const trigger = screen.getByRole("button", { name: "Elegir tema: Nodia" });
    await user.click(trigger);
    const search = screen.getByRole("combobox", { name: "Buscar un tema" });
    await user.type(search, "no-such-theme-987");
    expect(screen.getByRole("status")).toHaveTextContent("No hay temas que coincidan con la búsqueda.");
    act(() => window.dispatchEvent(new Event("resize")));
    expect(search).toHaveValue("no-such-theme-987");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(useThemeStore.getState().themeId).toBe(DEFAULT_THEME_ID);
    expect(sileo.success).not.toHaveBeenCalled();
  });

  it("keeps the search and selector open when saving fails, then permits a retry", async () => {
    const user = userEvent.setup();
    const changeTheme = vi.fn().mockImplementationOnce(() => { throw new Error("blocked storage"); });
    useThemeStore.setState({ handleChangeThemeId: changeTheme });
    render(<ThemePresetSelector />);
    await user.click(screen.getByRole("button", { name: "Elegir tema: Nodia" }));
    const search = screen.getByRole("combobox", { name: "Buscar un tema" });
    await user.type(search, alternative.name);
    await user.click(screen.getByRole("option", { name: alternative.name }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(search).toHaveValue(alternative.name);
    expect(sileo.error).toHaveBeenCalledOnce();
    expect(sileo.success).not.toHaveBeenCalled();
    await user.click(screen.getByRole("option", { name: alternative.name }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(changeTheme).toHaveBeenCalledTimes(2);
    expect(sileo.success).toHaveBeenCalledOnce();
  });
});
