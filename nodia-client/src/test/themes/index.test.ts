import { createTheme } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import { darkPalette, lightPalette } from "../../theme/palette";
import { DEFAULT_THEME_ID, isThemePresetId, resolveThemePreset, themePresets } from "../../themes";
import { contrastRatio, mixColor } from "../../themes/contrast";

describe("theme catalog", () => {
  it("keeps the existing Nodia palettes as the default, including historical configuration", () => {
    const nodia = resolveThemePreset(DEFAULT_THEME_ID);
    expect(nodia.light).toBe(lightPalette);
    expect(nodia.dark).toBe(darkPalette);
    for (const value of [undefined, null, "", "removed-theme", {}, [], 123, "toString", "__proto__"]) {
      expect(resolveThemePreset(value)).toBe(nodia);
      expect(isThemePresetId(value)).toBe(false);
    }
  });

  it("resolves all imported built-in palettes independently", () => {
    expect(themePresets).toHaveLength(44);
    expect(new Set(themePresets.map(({ id }) => id)).size).toBe(themePresets.length);
    for (const preset of themePresets) {
      expect(resolveThemePreset(preset.id)).toBe(preset);
      expect(isThemePresetId(preset.id)).toBe(true);
    }
    expect(resolveThemePreset("tweakcn-default").name).toBe("Tweakcn Default");
    expect(resolveThemePreset("notebook").light.background?.default).toMatch(/^#[\da-f]{6}$/);
    expect(resolveThemePreset("modern-minimal").light.background?.default).toBe("#ffffff");
    expect(resolveThemePreset("modern-minimal").dark.background?.paper).toBe("#262626");
  });

  it("provides readable text, colored actions and contained-button hover shades in every imported mode", () => {
    for (const preset of themePresets.filter(({ id }) => id !== DEFAULT_THEME_ID)) {
      for (const mode of ["light", "dark"] as const) {
        const { palette } = createTheme({ palette: preset[mode] });
        const surfaces = [palette.background.default, palette.background.paper, palette.background.surface];
        for (const foreground of [palette.text.primary, palette.text.secondary]) {
          for (const background of surfaces) {
            expect(contrastRatio(foreground, background), `${preset.id}/${mode}: text on ${background}`)
              .toBeGreaterThanOrEqual(4.5);
          }
        }
        for (const color of [palette.primary, palette.secondary, palette.tertiary,
          palette.error, palette.success, palette.warning, palette.info]) {
          for (const background of surfaces) {
            expect(contrastRatio(color.main, background), `${preset.id}/${mode}: colored text on ${background}`)
              .toBeGreaterThanOrEqual(4.5);
            const hoverBackground = mixColor(background, color.main, palette.action.hoverOpacity);
            expect(contrastRatio(color.main, hoverBackground), `${preset.id}/${mode}: colored text while hovered`)
              .toBeGreaterThanOrEqual(4.5);
          }
          for (const background of [color.main, color.light, color.dark]) {
            expect(contrastRatio(color.contrastText, background), `${preset.id}/${mode}: button text on ${background}`)
              .toBeGreaterThanOrEqual(4.5);
          }
        }
        expect(palette.mode).toBe(mode);
        expect(palette.border.default).toBe(preset[mode].divider);
      }
    }
  });
});
