// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const darkmatter: AppThemePreset = {
  "id": "darkmatter",
  "name": "Darkmatter",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#a95e34",
      "light": "#9f6a4d",
      "dark": "#8b4d2b",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#717171",
      "light": "#767676",
      "dark": "#5d5d5d",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#111827",
      "light": "#3c424e",
      "dark": "#0e1420",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#ce3a3a",
      "light": "#bc5252",
      "dark": "#a93030",
      "contrastText": "#fafafa"
    },
    "warning": {
      "main": "#9d6607",
      "light": "#96702d",
      "dark": "#815406",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#17823e",
      "light": "#398555",
      "dark": "#136b33",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#ffffff",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#111827",
      "secondary": "#6b7280",
      "inverse": "#ffffff",
      "disabled": "rgba(17, 24, 39, 0.38)"
    },
    "border": {
      "default": "#e5e7eb"
    },
    "divider": "#e5e7eb",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#6b7280",
      "hover": "rgba(17, 24, 39, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(169, 94, 52, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(17, 24, 39, 0.26)",
      "disabledBackground": "rgba(17, 24, 39, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(169, 94, 52, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#e78a53",
      "light": "#eb9f72",
      "dark": "#bd7144",
      "contrastText": "#121113"
    },
    "secondary": {
      "main": "#848485",
      "light": "#9a9a9b",
      "dark": "#757575",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#c1c1c1",
      "light": "#cccccc",
      "dark": "#9e9e9e",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#658c8c",
      "light": "#81a1a1",
      "dark": "#658282",
      "contrastText": "#121113"
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
      "default": "#121113",
      "paper": "#121212",
      "surface": "#121113"
    },
    "text": {
      "primary": "#c1c1c1",
      "secondary": "#888888",
      "inverse": "#000000",
      "disabled": "rgba(193, 193, 193, 0.5)"
    },
    "border": {
      "default": "#222222"
    },
    "divider": "#222222",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#888888",
      "hover": "rgba(193, 193, 193, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(231, 138, 83, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(193, 193, 193, 0.3)",
      "disabledBackground": "rgba(193, 193, 193, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(231, 138, 83, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default darkmatter;
