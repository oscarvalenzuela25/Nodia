// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const graphite: AppThemePreset = {
  "id": "graphite",
  "name": "Graphite",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#606060",
      "light": "#767676",
      "dark": "#4f4f4f",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#333333",
      "light": "#585858",
      "dark": "#2a2a2a",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#333333",
      "light": "#585858",
      "dark": "#2a2a2a",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#c23030",
      "light": "#c45151",
      "dark": "#9f2727",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#915d07",
      "light": "#976f30",
      "dark": "#774c06",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#157839",
      "light": "#3a8456",
      "dark": "#11622f",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#f0f0f0",
      "paper": "#f5f5f5",
      "surface": "#f5f5f5"
    },
    "text": {
      "primary": "#333333",
      "secondary": "#666666",
      "inverse": "#ffffff",
      "disabled": "rgba(51, 51, 51, 0.38)"
    },
    "border": {
      "default": "#d0d0d0"
    },
    "divider": "#d0d0d0",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#666666",
      "hover": "rgba(51, 51, 51, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(96, 96, 96, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(51, 51, 51, 0.26)",
      "disabledBackground": "rgba(51, 51, 51, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(96, 96, 96, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#a0a0a0",
      "light": "#b1b1b1",
      "dark": "#838383",
      "contrastText": "#1a1a1a"
    },
    "secondary": {
      "main": "#d9d9d9",
      "light": "#e0e0e0",
      "dark": "#b2b2b2",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#d9d9d9",
      "light": "#e0e0e0",
      "dark": "#b2b2b2",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#e16c6c",
      "light": "#e68686",
      "dark": "#b95959",
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
      "default": "#1a1a1a",
      "paper": "#202020",
      "surface": "#202020"
    },
    "text": {
      "primary": "#d9d9d9",
      "secondary": "#898989",
      "inverse": "#000000",
      "disabled": "rgba(217, 217, 217, 0.5)"
    },
    "border": {
      "default": "#353535"
    },
    "divider": "#353535",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#898989",
      "hover": "rgba(217, 217, 217, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(160, 160, 160, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(217, 217, 217, 0.3)",
      "disabledBackground": "rgba(217, 217, 217, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(160, 160, 160, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default graphite;
