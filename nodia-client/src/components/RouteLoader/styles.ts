import { styled } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";
import type { RouteLoaderVariant } from "./types";

export const LoaderContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== "variant",
})<{ variant: RouteLoaderVariant }>(({ theme, variant }) => {
  if (variant === "fullscreen") {
    return {
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: theme.spacing(2),
      [theme.breakpoints.up("sm")]: { padding: theme.spacing(3) },
      [theme.breakpoints.up("md")]: { padding: theme.spacing(4) },
      backgroundColor: theme.palette.background.default,
      position: "relative",
    };
  }

  return {
    width: "100%",
    minHeight: 420,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  };
});

export const FullscreenBox = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(2.5),
  textAlign: "center",
}));

export const LoaderMessage = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  fontWeight: 600,
  color: theme.palette.text.secondary,
  letterSpacing: "0.02em",
}));
