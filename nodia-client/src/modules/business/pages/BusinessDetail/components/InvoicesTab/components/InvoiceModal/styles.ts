import { Box, FormControlLabel, Switch } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";

export const FormContainer = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2.5),
}));

export const SwitchWrapper = styled(Box)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1, 1.5),
    borderRadius:
      typeof theme.shape.borderRadius === "number"
        ? theme.shape.borderRadius * 1.5
        : 8,
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255, 255, 255, 0.03)"
        : "rgba(0, 0, 0, 0.02)",
    border: `1px solid ${borderColor}`,
  };
});

export const StyledFormControlLabel = styled(FormControlLabel)(({ theme }) => ({
  margin: 0,
  width: "100%",
  justifyContent: "space-between",
  "& .MuiFormControlLabel-label": {
    fontWeight: 600,
    fontSize: "0.875rem",
    color: theme.palette.text.primary,
  },
}));

export const StyledSwitch = styled(Switch)(({ theme }) => ({
  "& .MuiSwitch-switchBase.Mui-checked": {
    color: theme.palette.success.main,
    "&:hover": {
      backgroundColor: "rgba(56, 142, 60, 0.08)",
    },
  },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
    backgroundColor: theme.palette.success.main,
  },
}));

export const FileDropzoneBox = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";

  return {
    padding: theme.spacing(2.5, 2),
    borderRadius: 12,
    border: `2px dashed ${theme.palette.divider}`,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "#fafafa",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.2s, background-color 0.2s",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      backgroundColor: isDark
        ? alpha(theme.palette.primary.main, 0.04)
        : alpha(theme.palette.primary.main, 0.02),
    },
  };
});

export const SelectedFileContainer = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === "dark";

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1.5, 2),
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
    gap: theme.spacing(1.5),
  };
});

export const ModalActionsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing(2),
  width: "100%",
}));
