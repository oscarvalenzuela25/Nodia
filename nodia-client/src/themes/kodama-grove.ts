// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const kodamaGrove: AppThemePreset = {
  "id": "kodama-grove",
  "name": "Kodama Grove",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#545e2f",
      "light": "#717852",
      "dark": "#454d27",
      "contrastText": "#fdfbf6"
    },
    "secondary": {
      "main": "#5c4b3e",
      "light": "#796b61",
      "dark": "#4b3e33",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#5c4b3e",
      "light": "#796b61",
      "dark": "#4b3e33",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#7b4e47",
      "light": "#8d6a64",
      "dark": "#65403a",
      "contrastText": "#faf8f2"
    },
    "warning": {
      "main": "#7d5006",
      "light": "#947033",
      "dark": "#674205",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#126731",
      "light": "#3d8256",
      "dark": "#0f5428",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4a41d5",
      "light": "#6b63dd",
      "dark": "#3d35af",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#e4d7b0",
      "paper": "#e7dbbf",
      "surface": "#f3ead2"
    },
    "text": {
      "primary": "#5c4b3e",
      "secondary": "#665b52",
      "inverse": "#ffffff",
      "disabled": "rgba(92, 75, 62, 0.38)"
    },
    "border": {
      "default": "#b19681"
    },
    "divider": "#b19681",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#665b52",
      "hover": "rgba(92, 75, 62, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(84, 94, 47, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(92, 75, 62, 0.26)",
      "disabledBackground": "rgba(92, 75, 62, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(84, 94, 47, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#aaba9f",
      "light": "#b9c6b0",
      "dark": "#8b9982",
      "contrastText": "#2a2521"
    },
    "secondary": {
      "main": "#ede4d4",
      "light": "#f0e9dc",
      "dark": "#c2bbae",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#b7b5b4",
      "light": "#c4c2c2",
      "dark": "#969494",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#d3ada5",
      "light": "#dbbcb5",
      "dark": "#ad8e87",
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
      "main": "#a8b0fa",
      "light": "#b8befb",
      "dark": "#8a90cd",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#3a3529",
      "paper": "#413c33",
      "surface": "#413c33"
    },
    "text": {
      "primary": "#ede4d4",
      "secondary": "#afa79e",
      "inverse": "#000000",
      "disabled": "rgba(237, 228, 212, 0.5)"
    },
    "border": {
      "default": "#5a5345"
    },
    "divider": "#5a5345",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#afa79e",
      "hover": "rgba(237, 228, 212, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(170, 186, 159, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(237, 228, 212, 0.3)",
      "disabledBackground": "rgba(237, 228, 212, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(170, 186, 159, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default kodamaGrove;
