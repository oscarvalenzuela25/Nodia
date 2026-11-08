import { Box, FormControlLabel, Switch } from "@mui/material";
import { styled } from "@mui/material/styles";

export const FormContainer = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2.5),
  minWidth: 0,
  "& label, & .MuiGrid-root, & .MuiFormControl-root": { minWidth: 0 },
  "& label": { overflowWrap: "anywhere" },
  [theme.breakpoints.down("sm")]: { "& .MuiButton-root": { minHeight: 44, whiteSpace: "normal", overflowWrap: "anywhere" } },
}));

export const SwitchWrapper = styled(Box)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    display: "flex",
    minWidth: 0,
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
  minWidth: 0,
  [theme.breakpoints.down("sm")]: { minHeight: 44 },
  "& .MuiFormControlLabel-label": {
    fontWeight: 600,
    fontSize: "0.875rem",
    color: theme.palette.text.primary,
    minWidth: 0,
    overflowWrap: "anywhere",
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

export const ModalActionsContainer = styled(Box)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: { flexDirection: "column-reverse", alignItems: "stretch", "& button": { width: "100%", minHeight: 44 } },
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing(2),
  width: "100%",
}));
