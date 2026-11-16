// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const catppuccin: AppThemePreset = {
  "id": "catppuccin",
  "name": "Catppuccin",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#6d2ec0",
      "light": "#8754cb",
      "dark": "#59269d",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#4c4f69",
      "light": "#6c6f84",
      "dark": "#3e4156",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#545454",
      "light": "#737373",
      "dark": "#454545",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#a80c2e",
      "light": "#b83854",
      "dark": "#8a0a26",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#764c05",
      "light": "#8f6c32",
      "dark": "#613e04",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#11622f",
      "light": "#3c7e54",
      "dark": "#0e5027",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#463ec9",
      "light": "#6761d3",
      "dark": "#3933a5",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#eff1f5",
      "paper": "#ffffff",
      "surface": "#ccd0da"
    },
    "text": {
      "primary": "#4c4f69",
      "secondary": "#555769",
      "inverse": "#ffffff",
      "disabled": "rgba(76, 79, 105, 0.38)"
    },
    "border": {
      "default": "#bcc0cc"
    },
    "divider": "#bcc0cc",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#555769",
      "hover": "rgba(76, 79, 105, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(109, 46, 192, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(76, 79, 105, 0.26)",
      "disabledBackground": "rgba(76, 79, 105, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(109, 46, 192, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#d8bbf9",
      "light": "#dfc7fa",
      "dark": "#b199cc",
      "contrastText": "#1e1e2e"
    },
    "secondary": {
      "main": "#cdd6f4",
      "light": "#d6ddf6",
      "dark": "#a8afc8",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#c7c7cb",
      "light": "#d1d1d4",
      "dark": "#a3a3a6",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f7b6c8",
      "light": "#f8c3d2",
      "dark": "#cb95a4",
      "contrastText": "#1e1e2e"
    },
    "warning": {
      "main": "#fcd34d",
      "light": "#fddb6d",
      "dark": "#cfad3f",
      "contrastText": "#000000"
    },
    "success": {
      "main": "#4fdf84",
      "light": "#6fe59a",
      "dark": "#41b76c",
      "contrastText": "#000000"
    },
    "info": {
      "main": "#bec4fb",
      "light": "#cacffc",
      "dark": "#9ca1ce",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#181825",
      "paper": "#1e1e2e",
      "surface": "#45475a"
    },
    "text": {
      "primary": "#cdd6f4",
      "secondary": "#b1b8cf",
      "inverse": "#000000",
      "disabled": "rgba(205, 214, 244, 0.5)"
    },
    "border": {
      "default": "#313244"
    },
    "divider": "#313244",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#b1b8cf",
      "hover": "rgba(205, 214, 244, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(216, 187, 249, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(205, 214, 244, 0.3)",
      "disabledBackground": "rgba(205, 214, 244, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(216, 187, 249, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default catppuccin;
