import { Box, IconButton } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const ImageArea = styled(Box)({ position: "relative", minWidth: 0 });
export const ImagePicker = styled(Box, { shouldForwardProp: prop => prop !== "previewVariant" })<{ previewVariant?: "form" | "viewer" }>(({ theme, previewVariant }) => ({
  width: "100%", minWidth: 0, height: previewVariant === "viewer" ? "min(54dvh, 560px)" : 280, minHeight: previewVariant === "viewer" ? 220 : undefined, borderRadius: theme.shape.borderRadius,
  border: `1px dashed ${theme.palette.divider}`, backgroundColor: alpha(theme.palette.primary.main, 0.035),
  color: theme.palette.text.secondary, overflow: "hidden",
  [theme.breakpoints.down("sm")]: { height: previewVariant === "viewer" ? "min(50dvh, 420px)" : 220, minHeight: previewVariant === "viewer" ? 140 : undefined },
  "& img": { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" },
}));
export const RemoveImageButton = styled(IconButton)(({ theme }) => ({
  width: 44, height: 44,
  backgroundColor: theme.palette.background.paper, color: theme.palette.error.main,
  border: `1px solid ${theme.palette.divider}`,
  "&:hover": { backgroundColor: theme.palette.background.default },
}));
