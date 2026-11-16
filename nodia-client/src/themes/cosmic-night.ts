// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const cosmicNight: AppThemePreset = {
  "id": "cosmic-night",
  "name": "Cosmic Night",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#6e56cf",
      "light": "#7b69c4",
      "dark": "#5a47aa",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#4a4080",
      "light": "#6b6297",
      "dark": "#3d3469",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#2a2a4a",
      "light": "#50506b",
      "dark": "#22223d",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#bd3e53",
      "light": "#b75968",
      "dark": "#9b3344",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#966007",
      "light": "#976f2e",
      "dark": "#7b4f06",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#157c3b",
      "light": "#398555",
      "dark": "#116630",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#f5f5ff",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#2a2a4a",
      "secondary": "#6c6c8a",
      "inverse": "#ffffff",
      "disabled": "rgba(42, 42, 74, 0.38)"
    },
    "border": {
      "default": "#e0e0f0"
    },
    "divider": "#e0e0f0",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#6c6c8a",
      "hover": "rgba(42, 42, 74, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(110, 86, 207, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(42, 42, 74, 0.26)",
      "disabledBackground": "rgba(42, 42, 74, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(110, 86, 207, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#a48fff",
      "light": "#b4a3ff",
      "dark": "#8675d1",
      "contrastText": "#0f0f1a"
    },
    "secondary": {
      "main": "#c4c2ff",
      "light": "#cfcdff",
      "dark": "#a19fd1",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#e2e2f5",
      "light": "#e7e7f7",
      "dark": "#b9b9c9",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#ff5470",
      "light": "#ff738a",
      "dark": "#d1455c",
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
      "default": "#0f0f1a",
      "paper": "#1a1a2e",
      "surface": "#1a1a2e"
    },
    "text": {
      "primary": "#e2e2f5",
      "secondary": "#a0a0c0",
      "inverse": "#000000",
      "disabled": "rgba(226, 226, 245, 0.5)"
    },
    "border": {
      "default": "#303052"
    },
    "divider": "#303052",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a0a0c0",
      "hover": "rgba(226, 226, 245, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(164, 143, 255, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(226, 226, 245, 0.3)",
      "disabledBackground": "rgba(226, 226, 245, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(164, 143, 255, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default cosmicNight;
