import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import type { BaseModalSize } from "./types";

const sizeWidthMap: Record<BaseModalSize, number> = {
  xs: 400,
  sm: 500,
  md: 640,
  lg: 800,
  xl: 1024,
};

export const StyledDialog = styled(Dialog, {
  shouldForwardProp: (prop) => prop !== "modalSize",
})<{ modalSize?: BaseModalSize }>(({ theme, modalSize = "sm" }) => {
  const targetWidth = sizeWidthMap[modalSize] ?? 500;
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    "& .MuiDialog-paper": {
      width: "100%",
      maxWidth: `min(${targetWidth}px, calc(100vw - 32px))`,
      borderRadius:
        typeof theme.shape.borderRadius === "number"
          ? theme.shape.borderRadius * 2
          : 16,
      backgroundColor: theme.palette.background.paper,
      backgroundImage: "none",
      boxShadow:
        theme.palette.mode === "dark"
          ? `0 24px 48px -12px ${alpha(
              theme.palette.common.black,
              0.7
            )}, 0 0 0 1px ${borderColor}`
          : `0 20px 40px -12px ${alpha(
              theme.palette.primary.main,
              0.15
            )}, 0 0 0 1px ${borderColor}`,
      overflow: "hidden",
      transition: theme.transitions.create(["box-shadow", "transform"], {
        duration: theme.transitions.duration.shorter,
      }),
    },
    "& .MuiBackdrop-root": {
      backgroundColor: alpha(
        theme.palette.common.black,
        theme.palette.mode === "dark" ? 0.7 : 0.4
      ),
      backdropFilter: "blur(4px)",
    },
  };
});

export const ModalHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: theme.spacing(2.5, 3, 1.5, 3),
  gap: theme.spacing(2),
}));

export const HeaderContent = styled(Box)({
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  flex: 1,
  minWidth: 0,
});

export const ModalTitle = styled("h2")(({ theme }) => ({
  ...theme.typography.h6,
  margin: 0,
  fontWeight: 700,
  color: theme.palette.text.primary,
  lineHeight: 1.3,
  letterSpacing: "-0.01em",
}));

export const ModalSubtitle = styled("p")(({ theme }) => ({
  ...theme.typography.body2,
  margin: 0,
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
}));

export const ModalContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2.5),
  overflowY: "auto",
}));

export const ModalActions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2, 3, 2.5, 3),
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: theme.spacing(2), // 16px gap
}));
