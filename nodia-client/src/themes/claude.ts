// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const claude: AppThemePreset = {
  "id": "claude",
  "name": "Claude",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#ab5538",
      "light": "#a56752",
      "dark": "#8c462e",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#535146",
      "light": "#727067",
      "dark": "#444239",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#28261b",
      "light": "#4f4d44",
      "dark": "#211f16",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#141413",
      "light": "#3e3e3d",
      "dark": "#101010",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#996207",
      "light": "#976f2e",
      "dark": "#7d5006",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#167e3c",
      "light": "#398555",
      "dark": "#126731",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#faf9f5",
      "paper": "#faf9f5",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#3d3929",
      "secondary": "#72716d",
      "inverse": "#ffffff",
      "disabled": "rgba(61, 57, 41, 0.38)"
    },
    "border": {
      "default": "#dad9d4"
    },
    "divider": "#dad9d4",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#72716d",
      "hover": "rgba(61, 57, 41, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(171, 85, 56, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(61, 57, 41, 0.26)",
      "disabledBackground": "rgba(61, 57, 41, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(171, 85, 56, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#e09075",
      "light": "#e6a48e",
      "dark": "#b87660",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#a4a4a3",
      "light": "#b4b4b4",
      "dark": "#868686",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#f5f4ee",
      "light": "#f7f6f1",
      "dark": "#c9c8c3",
      "contrastText": "#000000"
    },
    "error": {
      "main": "#f48181",
      "light": "#f69898",
      "dark": "#c86a6a",
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
      "main": "#939df9",
      "light": "#a6affa",
      "dark": "#7981cc",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#262624",
      "paper": "#262624",
      "surface": "#30302e"
    },
    "text": {
      "primary": "#c3c0b6",
      "secondary": "#b7b5a9",
      "inverse": "#000000",
      "disabled": "rgba(195, 192, 182, 0.5)"
    },
    "border": {
      "default": "#3e3e38"
    },
    "divider": "#3e3e38",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#b7b5a9",
      "hover": "rgba(195, 192, 182, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(224, 144, 117, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(195, 192, 182, 0.3)",
      "disabledBackground": "rgba(195, 192, 182, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(224, 144, 117, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default claude;
