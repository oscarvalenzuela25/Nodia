import type { PaletteOptions } from "@mui/material/styles";

export interface AppThemePreset {
  readonly id: string;
  readonly name: string;
  readonly light: PaletteOptions;
  readonly dark: PaletteOptions;
}

/** Normalized sRGB tokens from tweakcn; fonts, geometry and spacing stay Nodia's. */
export interface ThemeColorTokens {
  background: string;
  foreground: string;
  card: string;
  popover: string;
  primary: string;
  primaryForeground: string;
  secondaryForeground: string;
  accentForeground: string;
  mutedForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
}
