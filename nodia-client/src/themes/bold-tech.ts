// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const boldTech: AppThemePreset = {
  "id": "bold-tech",
  "name": "Bold Tech",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#8055e3",
      "light": "#8364c9",
      "dark": "#6946ba",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#4338ca",
      "light": "#655cd4",
      "dark": "#372ea6",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#1e40af",
      "light": "#4762bd",
      "dark": "#193490",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#ce3a3a",
      "light": "#c15454",
      "dark": "#a93030",
      "contrastText": "#ffffff"
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
      "primary": "#312e81",
      "secondary": "#7c3aed",
      "inverse": "#ffffff",
      "disabled": "rgba(49, 46, 129, 0.38)"
    },
    "border": {
      "default": "#e0e7ff"
    },
    "divider": "#e0e7ff",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#7c3aed",
      "hover": "rgba(49, 46, 129, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(128, 85, 227, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(49, 46, 129, 0.26)",
      "disabledBackground": "rgba(49, 46, 129, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(128, 85, 227, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#a27df8",
      "light": "#b394f9",
      "dark": "#8567cb",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#e0e7ff",
      "light": "#e6ebff",
      "dark": "#b8bdd1",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#e0e7ff",
      "light": "#e6ebff",
      "dark": "#b8bdd1",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f26161",
      "light": "#f47d7d",
      "dark": "#c65050",
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
      "default": "#0f172a",
      "paper": "#1e1b4b",
      "surface": "#1e1b4b"
    },
    "text": {
      "primary": "#e0e7ff",
      "secondary": "#c4b5fd",
      "inverse": "#000000",
      "disabled": "rgba(224, 231, 255, 0.5)"
    },
    "border": {
      "default": "#2e1065"
    },
    "divider": "#2e1065",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#c4b5fd",
      "hover": "rgba(224, 231, 255, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(162, 125, 248, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(224, 231, 255, 0.3)",
      "disabledBackground": "rgba(224, 231, 255, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(162, 125, 248, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default boldTech;
