// Adapted from jnsahaj/tweakcn a3b47b37; contrast precomputed for MUI.
// See README.md and public/licenses/tweakcn.txt (Apache-2.0).
import { lightPalette, darkPalette } from "../theme/palette";
import type { AppThemePreset } from "./types";

const tangerine: AppThemePreset = {
  "id": "tangerine",
  "name": "Tangerine",
  "light": {
    ...lightPalette,
    "mode": "light",
    "primary": {
      "main": "#a9462a",
      "light": "#ae624c",
      "dark": "#8b3922",
      "contrastText": "#ffffff"
    },
    "secondary": {
      "main": "#4b5563",
      "light": "#6b747f",
      "dark": "#3e4651",
      "contrastText": "#ffffff"
    },
    "tertiary": {
      "main": "#1e3a8a",
      "light": "#475d9f",
      "dark": "#193071",
      "contrastText": "#ffffff"
    },
    "error": {
      "main": "#b93434",
      "light": "#be5656",
      "dark": "#982b2b",
      "contrastText": "#ffffff"
    },
    "warning": {
      "main": "#8c5b06",
      "light": "#96702f",
      "dark": "#734b05",
      "contrastText": "#ffffff"
    },
    "success": {
      "main": "#147438",
      "light": "#3a8456",
      "dark": "#105f2e",
      "contrastText": "#ffffff"
    },
    "info": {
      "main": "#4f46e5",
      "light": "#6d65e7",
      "dark": "#4139bc",
      "contrastText": "#ffffff"
    },
    "background": {
      "default": "#e8ebed",
      "paper": "#ffffff",
      "surface": "#ffffff"
    },
    "text": {
      "primary": "#333333",
      "secondary": "#626976",
      "inverse": "#ffffff",
      "disabled": "rgba(51, 51, 51, 0.38)"
    },
    "border": {
      "default": "#dcdfe2"
    },
    "divider": "#dcdfe2",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#626976",
      "hover": "rgba(51, 51, 51, 0.04)",
      "hoverOpacity": 0.04,
      "selected": "rgba(169, 70, 42, 0.08)",
      "selectedOpacity": 0.08,
      "disabled": "rgba(51, 51, 51, 0.26)",
      "disabledBackground": "rgba(51, 51, 51, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(169, 70, 42, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  },
  "dark": {
    ...darkPalette,
    "mode": "dark",
    "primary": {
      "main": "#e98a6f",
      "light": "#ed9f89",
      "dark": "#bf715b",
      "contrastText": "#000000"
    },
    "secondary": {
      "main": "#e5e5e5",
      "light": "#eaeaea",
      "dark": "#bcbcbc",
      "contrastText": "#000000"
    },
    "tertiary": {
      "main": "#bfdbfe",
      "light": "#cbe1fe",
      "dark": "#9db4d0",
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
      "main": "#949df9",
      "light": "#a7affa",
      "dark": "#7981cc",
      "contrastText": "#000000"
    },
    "background": {
      "default": "#1c2433",
      "paper": "#2a3040",
      "surface": "#262b38"
    },
    "text": {
      "primary": "#e5e5e5",
      "secondary": "#a3a3a3",
      "inverse": "#000000",
      "disabled": "rgba(229, 229, 229, 0.5)"
    },
    "border": {
      "default": "#3d4354"
    },
    "divider": "#3d4354",
    "contrastThreshold": 4.5,
    "action": {
      "active": "#a3a3a3",
      "hover": "rgba(229, 229, 229, 0.08)",
      "hoverOpacity": 0.08,
      "selected": "rgba(233, 138, 111, 0.16)",
      "selectedOpacity": 0.16,
      "disabled": "rgba(229, 229, 229, 0.3)",
      "disabledBackground": "rgba(229, 229, 229, 0.12)",
      "disabledOpacity": 0.38,
      "focus": "rgba(233, 138, 111, 0.12)",
      "focusOpacity": 0.12,
      "activatedOpacity": 0.12
    }
  }
};

export default tangerine;
