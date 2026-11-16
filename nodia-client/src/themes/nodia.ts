import { darkPalette, lightPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

/** The existing Nodia palette is intentionally preserved byte-for-byte. */
const nodia: AppThemePreset = {
  id: "nodia",
  name: "Nodia",
  light: lightPalette,
  dark: darkPalette,
};

export default nodia;
