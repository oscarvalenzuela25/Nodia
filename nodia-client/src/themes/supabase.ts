// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const supabase: AppThemePreset = {
  "id": "supabase",
  "name": "Supabase",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#3e7b5e",
      "light": "#547f6b",
      "dark": "#33654d",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#171717",
      "light": "#414141",
      "dark": "#131313",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#202020",
      "light": "#484848",
      "dark": "#1a1a1a",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#ca3214",
      "light": "#c45039",
      "dark": "#a62910",
      "contrastText": "#fffcfc"
    },
    "warning": {
      "main": "#9b6407",
      "light": "#976f2d",
      "dark": "#7f5206",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#16803d",
      "light": "#398555",
      "dark": "#126932",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#fcfcfc",
      "paper": "#fcfcfc",
      "surface": "#fcfcfc"
    },
    "text": {
      "primary": "#171717",
      "secondary": "#202020",
      "inverse": "#ffffff",
      "disabled": "rgba(23, 23, 23, 0.38)"
    },
    "border": {
      "default": "#dfdfdf"
    },
    "divider": "#dfdfdf",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#202020",
      "hover": "rgba(23, 23, 23, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(62, 123, 94, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(23, 23, 23, 0.26)",
      "disabledBackground": "rgba(23, 23, 23, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(62, 123, 94, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#66a188",
      "light": "#82b29d",
      "dark": "#548470",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#fafafa",
      "light": "#fbfbfb",
      "dark": "#cdcdcd",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#fafafa",
      "light": "#fbfbfb",
      "dark": "#cdcdcd",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#ab908c",
      "light": "#baa4a1",
      "dark": "#8c7673",
      "contrastText": "#000000"
    },
    "warning": {
      "main": "#fcd34d",
      "light": "#fddb6d",
      "dark": "#cfad3f",
      "contrastText": "#000000"
    },
    "success": {
      "main": "#4ade80",
      "light": "#6be497",
      "dark": "#3db669",
      "contrastText": "#000000"
    },
    "info": {
      "main": "#818cf8",
      "light": "#98a1f9",
      "dark": "#6a73cb",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#121212",
      "paper": "#171717",
      "surface": "#242424"
    },
    "text": {
      "primary": "#e2e8f0",
      "secondary": "#a2a2a2",
      "inverse": "#000000",
      "disabled": "rgba(226, 232, 240, 0.5)"
    },
    "border": {
      "default": "#292929"
    },
    "divider": "#292929",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a2a2a2",
      "hover": "rgba(226, 232, 240, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(102, 161, 136, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(226, 232, 240, 0.3)",
      "disabledBackground": "rgba(226, 232, 240, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(102, 161, 136, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default supabase;
