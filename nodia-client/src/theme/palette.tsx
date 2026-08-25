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
    "50": "#e8eaf6",
    "100": "#c5cae9",
    "200": "#9fa8da",
    "300": "#7986cb",
    "400": "#5c6bc0",
    "500": "#19398d",
    "600": "#16337e",
    "700": "#122a69",
    "800": "#0f2254",
    "900": "#0b193f",
    light: "#5c6bc0",
    main: "#19398d",
    dark: "#122a69",
    contrastText: "#f3f5f9",
  },
  secondary: {
    "50": "#fafafa",
    "100": "#f5f5f5",
    "200": "#eeeeee",
    "300": "#e0e0e0",
    "400": "#bdbdbd",
    "500": "#0a0a0a",
    "600": "#090909",
    "700": "#070707",
    "800": "#060606",
    "900": "#040404",
    light: "#424242",
    main: "#0a0a0a",
    dark: "#000000",
    contrastText: "#f5f7fb",
  },
  tertiary: {
    "50": "#e0f2f1",
    "100": "#b2dfdb",
    "200": "#80cbc4",
    "300": "#4db6ac",
    "400": "#26a69a",
    "500": "#17ab92",
    "600": "#149983",
    "700": "#11806d",
    "800": "#0d6657",
    "900": "#0a4c41",
    light: "#26a69a",
    main: "#17ab92",
    dark: "#11806d",
    contrastText: "#ffffff",
  },
  error: {
    light: "#cd335c",
    main: "#9b0033",
    dark: "#6c0023",
    contrastText: "#ffffff",
  },
  warning: {
    light: "#ffb74d",
    main: "#f57c00",
    dark: "#e65100",
    contrastText: "#ffffff",
  },
  success: {
    light: "#81c784",
    main: "#388e3c",
    dark: "#1b5e20",
    contrastText: "#ffffff",
  },
  grey: {
    "50": "#fafafa",
    "100": "#f5f5f5",
    "200": "#eeeeee",
    "300": "#e0e0e0",
    "400": "#bdbdbd",
    "500": "#9e9e9e",
    "600": "#757575",
    "700": "#616161",
    "800": "#424242",
    "900": "#212121",
    A100: "#f5f5f5",
    A200: "#eeeeee",
    A400: "#bdbdbd",
    A700: "#616161",
  },
  background: {
    default: "#f3f5fb",
    surface: "#ffffff",
    paper: "#ffffff",
  },
  text: {
    primary: "#010101",
    secondary: "#454545",
    inverse: "#ffffff",
    disabled: "rgba(1, 1, 1, 0.38)",
  },
  border: {
    default: "#e3e3e3",
  },
  common: {
    black: "#000000",
    white: "#ffffff",
  },
  info: {
    light: "#42a5f5",
    main: "#0159b7",
    dark: "#1565c0",
    contrastText: "#ffffff",
  },
  contrastThreshold: 3,
  tonalOffset: 0.2,
  divider: "rgba(1, 1, 1, 0.12)",
  action: {
    active: "rgba(1, 1, 1, 0.54)",
    hover: "rgba(1, 1, 1, 0.04)",
    hoverOpacity: 0.04,
    selected: "rgba(1, 1, 1, 0.08)",
    selectedOpacity: 0.08,
    disabled: "rgba(1, 1, 1, 0.26)",
    disabledBackground: "rgba(1, 1, 1, 0.12)",
    disabledOpacity: 0.38,
    focus: "rgba(1, 1, 1, 0.12)",
    focusOpacity: 0.12,
    activatedOpacity: 0.12,
  },
};

export const darkPalette: PaletteOptions = {
  mode: "dark",
  primary: {
    "50": "#e3f2fd",
    "100": "#bbdefb",
    "200": "#90caf9",
    "300": "#64b5f6",
    "400": "#42a5f5",
    "500": "#6a8dd8",
    "600": "#5079d1",
    "700": "#325fbf",
    "800": "#284c99",
    "900": "#1e3972",
    light: "#90caf9",
    main: "#6a8dd8",
    dark: "#325fbf",
    contrastText: "#0a0a0a",
  },
  secondary: {
    "50": "#424242",
    "100": "#303030",
    "200": "#212121",
    "300": "#111111",
    "400": "#0a0a0a",
    "500": "#171717",
    "600": "#141414",
    "700": "#111111",
    "800": "#0d0d0d",
    "900": "#0a0a0a",
    light: "#424242",
    main: "#171717",
    dark: "#0a0a0a",
    contrastText: "#fafafa",
  },
  tertiary: {
    "50": "#9e9e9e",
    "100": "#757575",
    "200": "#616161",
    "300": "#424242",
    "400": "#303030",
    "500": "#404040",
    "600": "#393939",
    "700": "#303030",
    "800": "#262626",
    "900": "#1c1c1c",
    light: "#757575",
    main: "#404040",
    dark: "#303030",
    contrastText: "#fafafa",
  },
  error: {
    light: "#d78b95",
    main: "#cd6e7b",
    dark: "#8f4d56",
    contrastText: "#fafafa",
  },
  warning: {
    light: "#d68f76",
    main: "#cc7455",
    dark: "#8e513b",
    contrastText: "#fafafa",
  },
  success: {
    light: "#6fc2b3",
    main: "#4bb3a1",
    dark: "#347d70",
    contrastText: "#fafafa",
  },
  grey: {
    "50": "#fafafa",
    "100": "#f5f5f5",
    "200": "#eeeeee",
    "300": "#e0e0e0",
    "400": "#bdbdbd",
    "500": "#9e9e9e",
    "600": "#757575",
    "700": "#616161",
    "800": "#424242",
    "900": "#212121",
    A100: "#f5f5f5",
    A200: "#eeeeee",
    A400: "#bdbdbd",
    A700: "#616161",
  },
  background: {
    default: "#050505",
    surface: "#171717",
    paper: "#0a0a0a",
  },
  text: {
    primary: "#fafafa",
    secondary: "#a1a1a1",
    inverse: "#010101",
    disabled: "rgba(255, 255, 255, 0.5)",
  },
  border: {
    default: "#282828",
  },
  common: {
    black: "#000000",
    white: "#ffffff",
  },
  info: {
    light: "#4fc3f7",
    main: "#2062ce",
    dark: "#0288d1",
    contrastText: "#0a0a0a",
  },
  contrastThreshold: 3,
  tonalOffset: 0.2,
  divider: "rgba(255, 255, 255, 0.12)",
  action: {
    active: "rgba(255, 255, 255, 0.7)",
    hover: "rgba(255, 255, 255, 0.08)",
    hoverOpacity: 0.08,
    selected: "rgba(255, 255, 255, 0.16)",
    selectedOpacity: 0.16,
    disabled: "rgba(255, 255, 255, 0.3)",
    disabledBackground: "rgba(255, 255, 255, 0.12)",
    disabledOpacity: 0.38,
    focus: "rgba(255, 255, 255, 0.12)",
    focusOpacity: 0.12,
    activatedOpacity: 0.12,
  },
};
