import { Paper } from "@mui/material";
import { styled } from "@mui/material/styles";

export const PreferencePanel = styled(Paper)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  boxShadow: "none",
  padding: theme.spacing(1.5, 2),
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  minWidth: 0,
  "& .MuiFormControlLabel-root": {
    margin: 0,
    flexShrink: 0,
    gap: theme.spacing(0.5),
  },
  "& .MuiFormControlLabel-label": { fontWeight: 600 },
  "& .MuiAlert-root": { width: "100%" },
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column-reverse",
    alignItems: "stretch",
    gap: theme.spacing(0.5),
    "& .MuiFormControlLabel-root": { justifyContent: "space-between" },
  },
}));
