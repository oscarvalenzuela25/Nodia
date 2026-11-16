import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "@mui/material/styles";
import { afterEach, describe, expect, it, vi } from "vitest";
import MUIProvider from "../../providers/MUIProvider";
import useThemeStore from "../../store/configStore";
import { themePresets } from "../../themes";
import { darkPalette, lightPalette } from "../../theme/palette";

vi.mock("sileo", () => ({ Toaster: () => null }));

function Draft() {
  const [value, setValue] = useState("");
  const theme = useTheme();
  return <>
    <input aria-label="Draft" value={value} onChange={(event) => setValue(event.target.value)} />
    <output aria-label="Primary">{theme.palette.primary.main}</output>
    <output aria-label="Mode">{theme.palette.mode}</output>
    <output aria-label="Radius">{theme.shape.borderRadius}</output>
  </>;
}

afterEach(() => useThemeStore.setState({ themeId: "nodia", themeType: "dark" }));

describe("MUIProvider theme selection", () => {
  it("applies preset and mode without replacing a focused draft or shared geometry", async () => {
    useThemeStore.setState({ themeId: "nodia", themeType: "dark" });
    render(<MUIProvider><Draft /></MUIProvider>);
    const input = screen.getByRole("textbox", { name: "Draft" });
    await userEvent.setup().type(input, "Keep my draft");
    expect(screen.getByLabelText("Primary")).toHaveTextContent((darkPalette.primary as { main: string }).main);
    const preset = themePresets.find(({ id }) => id !== "nodia")!;
    act(() => useThemeStore.getState().handleChangeThemeId(preset.id));
    expect(screen.getByLabelText("Primary")).toHaveTextContent((preset.dark.primary as { main: string }).main);
    act(() => useThemeStore.getState().handleChangeThemeType("light"));
    expect(screen.getByLabelText("Primary")).toHaveTextContent((preset.light.primary as { main: string }).main);
    expect(screen.getByLabelText("Mode")).toHaveTextContent("light");
    expect(screen.getByLabelText("Radius")).toHaveTextContent("8");
    expect(screen.getByRole("textbox", { name: "Draft" })).toBe(input);
    expect(input).toHaveValue("Keep my draft");
    expect(input).toHaveFocus();
    act(() => useThemeStore.getState().handleChangeThemeId("nodia"));
    expect(screen.getByLabelText("Primary")).toHaveTextContent((lightPalette.primary as { main: string }).main);
  });
});
