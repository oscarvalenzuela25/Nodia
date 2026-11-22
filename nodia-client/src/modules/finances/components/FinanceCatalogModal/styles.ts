import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

export const FormContainer = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2.5),
}));

export const FinanceFormRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2, 2),
  gridTemplateColumns: "minmax(0, 1fr)",
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
}));

export const ModalActions = styled(Box)(({ theme }) => ({
  display: "flex",
  width: "100%",
  gap: theme.spacing(2),
  justifyContent: "flex-end",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    "& button": { width: "100%", minHeight: 44 },
  },
}));
