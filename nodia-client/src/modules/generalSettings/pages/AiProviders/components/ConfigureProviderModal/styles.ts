import { styled, alpha } from "@mui/material/styles";
import { Box, FormControlLabel, Switch, Paper } from "@mui/material";

export const FormContainer = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2.5),
}));

export const ProviderSummaryBox = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.primary.main, 0.04),
}));

export const ModeOptionsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: theme.spacing(1.5),
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

export const ModeOptionCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== "selected" && prop !== "disabled",
})<{ selected?: boolean; disabled?: boolean }>(({ theme, selected, disabled }) => ({
  padding: theme.spacing(2),
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  border: `2px solid ${
    selected
      ? theme.palette.primary.main
      : theme.palette.divider
  }`,
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.06)
    : theme.palette.background.paper,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  transition: theme.transitions.create(["border-color", "background-color"], {
    duration: theme.transitions.duration.shorter,
  }),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.75),
  "&:hover": {
    borderColor: disabled
      ? theme.palette.divider
      : theme.palette.primary.main,
  },
}));

export const SwitchWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.background.default, 0.5),
}));

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
      backgroundColor: alpha(theme.palette.success.main, 0.08),
    },
  },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
    backgroundColor: theme.palette.success.main,
  },
}));

export const ModalActionsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing(1.5),
  width: "100%",
}));
