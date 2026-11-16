import { alpha } from "@mui/material/styles";
import type { PaletteOptions, SimplePaletteColorOptions } from "@mui/material/styles";
import { darkPalette, lightPalette } from "../theme/palette";
import { mixColor, readableColor, readableForeground } from "./contrast";
import type { AppThemePreset, ThemeColorTokens } from "./types";

const actionColor = (
  source: string,
  surfaces: readonly string[],
  hoverOpacity: number,
  preferredForeground?: string,
): SimplePaletteColorOptions => {
  const main = readableColor(source, surfaces, 4.6, hoverOpacity);
  const contrastText = readableForeground(main, preferredForeground);
  return {
    main,
    // Contained-button hover shades retain the same readable foreground.
    light: readableColor(mixColor(main, "#ffffff", 0.18), [contrastText], 4.5),
    dark: readableColor(mixColor(main, "#000000", 0.18), [contrastText], 4.5),
    contrastText,
  };
};

export const adaptTweakcnPalette = (
  tokens: ThemeColorTokens,
  mode: "light" | "dark",
): PaletteOptions => {
  const base = mode === "light" ? lightPalette : darkPalette;
  const surfaces = [tokens.background, tokens.card, tokens.popover];
  const hoverOpacity = mode === "dark" ? 0.08 : 0.04;
  const textPrimary = readableColor(tokens.foreground, surfaces);
  const textSecondary = readableColor(tokens.mutedForeground, surfaces);
  const primary = actionColor(tokens.primary, surfaces, hoverOpacity, tokens.primaryForeground);
  const secondary = actionColor(tokens.secondaryForeground, surfaces, hoverOpacity);
  const tertiary = actionColor(tokens.accentForeground, surfaces, hoverOpacity);
  const colorForStatus = (color: NonNullable<PaletteOptions["success"]>) => {
    if (!("main" in color) || !color.main) {
      throw new Error("Nodia semantic status colors require a main color");
    }
    return actionColor(color.main, surfaces, hoverOpacity, color.contrastText);
  };

  return {
    ...base,
    mode,
    primary,
    secondary,
    tertiary,
    error: actionColor(tokens.destructive, surfaces, hoverOpacity, tokens.destructiveForeground),
    warning: colorForStatus(base.warning!),
    success: colorForStatus(base.success!),
    info: colorForStatus(base.info!),
    background: {
      default: tokens.background,
      paper: tokens.card,
      surface: tokens.popover,
    },
    text: {
      primary: textPrimary,
      secondary: textSecondary,
      inverse: readableForeground(textPrimary),
      disabled: alpha(textPrimary, mode === "dark" ? 0.5 : 0.38),
    },
    border: { default: tokens.border },
    divider: tokens.border,
    contrastThreshold: 4.5,
    action: {
      ...base.action,
      active: textSecondary,
      hover: alpha(textPrimary, mode === "dark" ? 0.08 : 0.04),
      selected: alpha(primary.main, mode === "dark" ? 0.16 : 0.08),
      focus: alpha(primary.main, 0.12),
      disabled: alpha(textPrimary, mode === "dark" ? 0.3 : 0.26),
      disabledBackground: alpha(textPrimary, 0.12),
    },
  };
};

export const createTweakcnPreset = (
  id: string,
  name: string,
  tokens: { light: ThemeColorTokens; dark: ThemeColorTokens },
): AppThemePreset => ({
  id,
  name,
  light: adaptTweakcnPalette(tokens.light, "light"),
  dark: adaptTweakcnPalette(tokens.dark, "dark"),
});
