import { createTheme } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { adaptTweakcnPalette } from "../../themes/adaptTweakcn";
import { contrastRatio, mixColor } from "../../themes/contrast";
import type { ThemeColorTokens } from "../../themes/types";

describe("tweakcn to MUI color adaptation", () => {
  it("repairs unreadable source colors while preserving surfaces and status meaning", () => {
    const tokens: ThemeColorTokens = {
      background: "#ffffff", card: "#f8f8f8", popover: "#fafafa",
      foreground: "#222222", mutedForeground: "#aaaaaa", border: "#dddddd",
      primary: "#eeeeee", primaryForeground: "#ffffff",
      secondaryForeground: "#444444", accentForeground: "#333333",
      destructive: "#ef4444", destructiveForeground: "#ffffff",
    };
    const { palette } = createTheme({ palette: adaptTweakcnPalette(tokens, "light") });
    expect(palette.background).toMatchObject({ default: tokens.background, paper: tokens.card, surface: tokens.popover });
    expect(palette.text.primary).toBe(tokens.foreground);
    expect(palette.text.secondary).not.toBe(tokens.mutedForeground);
    expect(palette.primary.main).not.toBe(tokens.primary);
    expect(palette.secondary.main).toBe(tokens.secondaryForeground);
    expect(palette.border.default).toBe(tokens.border);
    for (const background of [tokens.background, tokens.card, tokens.popover]) {
      expect(contrastRatio(palette.text.secondary, background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.primary.main,
        mixColor(background, palette.primary.main, palette.action.hoverOpacity))).toBeGreaterThanOrEqual(4.5);
    }
    // A theme's accent never replaces the semantic error, success or warning colors.
    expect(palette.error.main).not.toBe(palette.primary.main);
    expect(palette.success.main).not.toBe(palette.primary.main);
    expect(palette.warning.main).not.toBe(palette.primary.main);
  });
});
