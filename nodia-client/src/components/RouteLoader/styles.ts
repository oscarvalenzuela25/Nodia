import { styled, alpha } from "@mui/material/styles";
import { Box, LinearProgress, Typography } from "@mui/material";
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
      padding: theme.spacing(4),
      backgroundColor: theme.palette.background.default,
      position: "relative",
    };
  }

  return {
    width: "100%",
    minHeight: 420,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    position: "relative",
  };
});

export const TopProgressBar = styled(LinearProgress)(({ theme }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 3,
  borderRadius: 0,
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
  "& .MuiLinearProgress-bar": {
    borderRadius: theme.shape.borderRadius,
  },
}));

export const SkeletonHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  maxWidth: 480,
  width: "100%",
}));

export const SkeletonCard = styled(Box)(({ theme }) => ({
  width: "100%",
  minHeight: 320,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor:
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.03)
      : alpha(theme.palette.common.black, 0.02),
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(3),
  gap: theme.spacing(2),
}));

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
