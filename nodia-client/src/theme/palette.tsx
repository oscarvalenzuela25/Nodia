import type {
  PaletteOptions,
  PaletteColorOptions,
  PaletteColor,
} from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface TypeBackground {
    surface: string;
  }
  interface TypeText {
    inverse: string;
  }
  interface Palette {
    tertiary: PaletteColor;
    border: {
      default: string;
    };
  }
  interface PaletteOptions {
    tertiary?: PaletteColorOptions;
    border?: {
      default: string;
    };
  }
}

export const lightPalette: PaletteOptions = {
  mode: "light",
  primary: {
    "50": "#eef2ff",
    "100": "#e0e7ff",
    "200": "#c7d2fe",
    "300": "#a5b4fc",
    "400": "#818cf8",
    "500": "#6366f1",
    "600": "#4f46e5",
    "700": "#4338ca",
    "800": "#3730a3",
    "900": "#312e81",
    light: "#818cf8",
    main: "#4f46e5",
    dark: "#3730a3",
    contrastText: "#ffffff",
  },
  secondary: {
    "50": "#f0fdfa",
    "100": "#ccfbf1",
    "200": "#99f6e4",
    "300": "#5eead4",
    "400": "#2dd4bf",
    "500": "#14b8a6",
    "600": "#0d9488",
    "700": "#0f766e",
    "800": "#115e59",
    "900": "#134e4a",
    light: "#2dd4bf",
    main: "#14b8a6",
    dark: "#0f766e",
    contrastText: "#ffffff",
  },
  tertiary: {
    "50": "#fffbeb",
    "100": "#fef3c7",
    "200": "#fde68a",
    "300": "#fcd34d",
    "400": "#fbbf24",
    "500": "#f59e0b",
    "600": "#d97706",
    "700": "#b45309",
    "800": "#92400e",
    "900": "#78350f",
    light: "#fbbf24",
    main: "#f59e0b",
    dark: "#d97706",
    contrastText: "#000000",
  },
  error: {
    light: "#f87171",
    main: "#ef4444",
    dark: "#dc2626",
    contrastText: "#ffffff",
  },
  warning: {
    light: "#fbbf24",
    main: "#f59e0b",
    dark: "#d97706",
    contrastText: "#000000",
  },
  success: {
    light: "#4ade80",
    main: "#22c55e",
    dark: "#16a34a",
    contrastText: "#ffffff",
  },
  info: {
    light: "#a5b4fc",
    main: "#4f46e5",
    dark: "#3730a3",
    contrastText: "#ffffff",
  },
  grey: {
    "50": "#fafafa",
    "100": "#f0f0f0",
    "200": "#e5e5e5",
    "300": "#d4d4d4",
    "400": "#a3a3a3",
    "500": "#737373",
    "600": "#525252",
    "700": "#404040",
    "800": "#333333",
    "900": "#171717",
    A100: "#f0f0f0",
    A200: "#e5e5e5",
    A400: "#737373",
    A700: "#333333",
  },
  background: {
    default: "#f7f9f3",
    surface: "#ffffff",
    paper: "#ffffff",
  },
  text: {
    primary: "#000000",
    secondary: "#333333",
    inverse: "#ffffff",
    disabled: "rgba(0, 0, 0, 0.38)",
  },
  border: {
    default: "rgba(0, 0, 0, 0.15)",
  },
  common: {
    black: "#000000",
    white: "#ffffff",
  },
  contrastThreshold: 3,
  tonalOffset: 0.2,
  divider: "rgba(0, 0, 0, 0.1)",
  action: {
    active: "rgba(0, 0, 0, 0.54)",
    hover: "rgba(0, 0, 0, 0.04)",
    hoverOpacity: 0.04,
    selected: "rgba(79, 70, 229, 0.08)",
    selectedOpacity: 0.08,
    disabled: "rgba(0, 0, 0, 0.26)",
    disabledBackground: "rgba(0, 0, 0, 0.12)",
    disabledOpacity: 0.38,
    focus: "rgba(79, 70, 229, 0.12)",
    focusOpacity: 0.12,
    activatedOpacity: 0.12,
  },
};

export const darkPalette: PaletteOptions = {
  mode: "dark",
  primary: {
    "50": "#eef2ff",
    "100": "#e0e7ff",
    "200": "#c7d2fe",
    "300": "#a5b4fc",
    "400": "#818cf8",
    "500": "#6366f1",
    "600": "#4f46e5",
    "700": "#4338ca",
    "800": "#3730a3",
    "900": "#312e81",
    light: "#a5b4fc",
    main: "#818cf8",
    dark: "#4f46e5",
    contrastText: "#000000",
  },
  secondary: {
    "50": "#f0fdfa",
    "100": "#ccfbf1",
    "200": "#99f6e4",
    "300": "#5eead4",
    "400": "#2dd4bf",
    "500": "#14b8a6",
    "600": "#0d9488",
    "700": "#0f766e",
    "800": "#115e59",
    "900": "#134e4a",
    light: "#5eead4",
    main: "#2dd4bf",
    dark: "#14b8a6",
    contrastText: "#000000",
  },
  tertiary: {
    "50": "#fffbeb",
    "100": "#fef3c7",
    "200": "#fde68a",
    "300": "#fcd34d",
    "400": "#fbbf24",
    "500": "#f59e0b",
    "600": "#d97706",
    "700": "#b45309",
    "800": "#92400e",
    "900": "#78350f",
    light: "#fde68a",
    main: "#fcd34d",
    dark: "#f59e0b",
    contrastText: "#000000",
  },
  error: {
    light: "#fca5a5",
    main: "#f87171",
    dark: "#ef4444",
    contrastText: "#000000",
  },
  warning: {
    light: "#fde68a",
    main: "#fcd34d",
    dark: "#f59e0b",
    contrastText: "#000000",
  },
  success: {
    light: "#86efac",
    main: "#4ade80",
    dark: "#22c55e",
    contrastText: "#000000",
  },
  info: {
    light: "#a5b4fc",
    main: "#818cf8",
    dark: "#4f46e5",
    contrastText: "#000000",
  },
  grey: {
    "50": "#fafafa",
    "100": "#f5f5f5",
    "200": "#e5e5e5",
    "300": "#d4d4d4",
    "400": "#cccccc",
    "500": "#737373",
    "600": "#525252",
    "700": "#404040",
    "800": "#333333",
    "900": "#1a212b",
    A100: "#cccccc",
    A200: "#737373",
    A400: "#545454",
    A700: "#333333",
  },
  background: {
    default: "#000000",
    surface: "#1a212b",
    paper: "#1a212b",
  },
  text: {
    primary: "#ffffff",
    secondary: "#cccccc",
    inverse: "#000000",
    disabled: "rgba(255, 255, 255, 0.5)",
  },
  border: {
    default: "#545454",
  },
  common: {
    black: "#000000",
    white: "#ffffff",
  },
  contrastThreshold: 3,
  tonalOffset: 0.2,
  divider: "rgba(255, 255, 255, 0.12)",
  action: {
    active: "rgba(255, 255, 255, 0.7)",
    hover: "rgba(255, 255, 255, 0.08)",
    hoverOpacity: 0.08,
    selected: "rgba(129, 140, 248, 0.16)",
    selectedOpacity: 0.16,
    disabled: "rgba(255, 255, 255, 0.3)",
    disabledBackground: "rgba(255, 255, 255, 0.12)",
    disabledOpacity: 0.38,
    focus: "rgba(129, 140, 248, 0.12)",
    focusOpacity: 0.12,
    activatedOpacity: 0.12,
  },
};
