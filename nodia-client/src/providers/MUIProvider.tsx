import type { FC, PropsWithChildren } from "react";
import { CssBaseline } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Toaster } from "sileo";
import typography from "../theme/typography";
import spacing from "../theme/spacing";
import breakpoints from "../theme/breakpoints";
import zIndex from "../theme/zIndex";
import transitions from "../theme/transitions";
import components from "../theme/components";
import useThemeType from "../hooks/useThemeType";
import { darkPalette, lightPalette } from "../theme/palette";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { esES, enUS } from "@mui/x-date-pickers/locales";
import { useTranslation } from "react-i18next";
import "dayjs/locale/es";
import "dayjs/locale/en";

type Props = PropsWithChildren;

const MUIProvider: FC<Props> = ({ children }) => {
  const { i18n } = useTranslation();
  const { themeType } = useThemeType();
  const palette = themeType === "light" ? lightPalette : darkPalette;

  const theme = createTheme({
    cssVariables: true,
    palette,
    typography,
    spacing,
    breakpoints,
    zIndex,
    transitions,
    components,
    shape: {
      borderRadius: 8,
    },
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Toaster position="bottom-right" theme={themeType} />
      <LocalizationProvider
        dateAdapter={AdapterDayjs}
        adapterLocale={i18n.language.startsWith("es") ? "es" : "en"}
        localeText={
          (i18n.language.startsWith("es") ? esES : enUS).components
            .MuiLocalizationProvider.defaultProps.localeText
        }
      >
        {children}
      </LocalizationProvider>
    </ThemeProvider>
  );
};

export default MUIProvider;
