// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const quantumRose: AppThemePreset = {
  "id": "quantum-rose",
  "name": "Quantum Rose",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#ce056e",
      "light": "#d63287",
      "dark": "#a9045a",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#91185c",
      "light": "#a54279",
      "dark": "#77144b",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#91185c",
      "light": "#a54279",
      "dark": "#77144b",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#c03461",
      "light": "#bd5375",
      "dark": "#9d2b50",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#946007",
      "light": "#96702f",
      "dark": "#794f06",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#157a3a",
      "light": "#3a8555",
      "dark": "#116430",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#fff0f8",
      "paper": "#fff7fc",
      "surface": "#fff7fc"
    },
    "text": {
      "primary": "#91185c",
      "secondary": "#ba407f",
      "inverse": "#ffffff",
      "disabled": "rgba(145, 24, 92, 0.38)"
    },
    "border": {
      "default": "#ffc7e6"
    },
    "divider": "#ffc7e6",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#ba407f",
      "hover": "rgba(145, 24, 92, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(206, 5, 110, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(145, 24, 92, 0.26)",
      "disabledBackground": "rgba(145, 24, 92, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(206, 5, 110, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#ff6bef",
      "light": "#ff86f2",
      "dark": "#d158c4",
      "contrastText": "#180518"
    },
    "secondary": {
      "main": "#ffb3ff",
      "light": "#ffc1ff",
      "dark": "#d193d1",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#ffb3ff",
      "light": "#ffc1ff",
      "dark": "#d193d1",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#ff4186",
      "light": "#ff639c",
      "dark": "#d23770",
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
      "default": "#1a0922",
      "paper": "#2a1435",
      "surface": "#2a1435"
    },
    "text": {
      "primary": "#ffb3ff",
      "secondary": "#d67ad6",
      "inverse": "#000000",
      "disabled": "rgba(255, 179, 255, 0.5)"
    },
    "border": {
      "default": "#4a1b5f"
    },
    "divider": "#4a1b5f",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#d67ad6",
      "hover": "rgba(255, 179, 255, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(255, 107, 239, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(255, 179, 255, 0.3)",
      "disabledBackground": "rgba(255, 179, 255, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(255, 107, 239, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default quantumRose;
