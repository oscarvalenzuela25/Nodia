import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

export const PaymentForm = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.25),
  minWidth: 0,
}));

export const AmountRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  alignItems: "start",
  gap: theme.spacing(1),
  minWidth: 0,
  "& > label": { alignSelf: "start", paddingBlockStart: theme.spacing(1) },
}));

export const Balance = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "baseline",
  justifyContent: "space-between",
  minWidth: 0,
  gap: theme.spacing(0.5, 1),
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.spacing(1),
  background: theme.palette.action.hover,
}));

export const DialogActions = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "end",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  width: "100%",
  "& > button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: {
    "& > button": { width: "100%" },
  },
}));
