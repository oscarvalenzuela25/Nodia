import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Button,
} from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import type { ConfirmDialogSize } from "./types";

const sizeWidthMap: Record<ConfirmDialogSize, number> = {
  xs: 380,
  sm: 460,
  md: 560,
  lg: 720,
};

export const StyledDialog = styled(Dialog, {
  shouldForwardProp: (prop) => prop !== "modalSize",
})<{ modalSize?: ConfirmDialogSize }>(({ theme, modalSize = "sm" }) => {
  const targetWidth = sizeWidthMap[modalSize] ?? 460;
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

export const DialogHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(2.5, 3, 1.5, 3),
  gap: theme.spacing(2),
}));

export const DialogTitle = styled("h2")(({ theme }) => ({
  ...theme.typography.h6,
  margin: 0,
  fontWeight: 700,
  color: theme.palette.text.primary,
  lineHeight: 1.3,
  letterSpacing: "-0.01em",
}));

export const DialogBody = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(1, 3, 2, 3),
  ...theme.typography.body2,
  color: theme.palette.text.secondary,
  lineHeight: 1.6,
  overflowY: "auto",
}));

export const DialogActionsContainer = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(1.5, 3, 2.5, 3),
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

export const CancelButton = styled(Button)(({ theme }) => ({
  textTransform: "none",
  fontWeight: 600,
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 1.5
      : 8,
  padding: theme.spacing(1, 2.5),
  backgroundColor:
    theme.palette.mode === "dark"
      ? theme.palette.grey[800]
      : theme.palette.grey[200],
  color:
    theme.palette.mode === "dark"
      ? theme.palette.grey[200]
      : theme.palette.grey[800],
  boxShadow: "none",
  "&:hover": {
    backgroundColor:
      theme.palette.mode === "dark"
        ? theme.palette.grey[700]
        : theme.palette.grey[300],
    boxShadow: "none",
  },
  "&:disabled": {
    opacity: 0.6,
  },
}));

export const ConfirmButton = styled(Button)(({ theme }) => ({
  textTransform: "none",
  fontWeight: 600,
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 1.5
      : 8,
  padding: theme.spacing(1, 2.5),
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  boxShadow: "none",
  "&:hover": {
    backgroundColor: theme.palette.primary.dark,
    boxShadow: "none",
  },
  "&:disabled": {
    opacity: 0.6,
  },
}));
