import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

export const Content = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
}));
export const FormContainer = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
}));
export const RuleRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) 44px",
  columnGap: theme.spacing(2),
  rowGap: "6px",
  "& > :not(button)": {
    minWidth: 0,
    display: "grid",
    gridTemplateRows: "subgrid",
    gridColumn: 1,
    gridRow: "span 3",
    "& > .MuiFormControl-root": {
      display: "grid",
      gridTemplateRows: "subgrid",
      gridRow: "span 2",
    },
  },
  "& > button": {
    gridColumn: 2,
    gridRow: 5,
    alignSelf: "center",
    justifySelf: "center",
    width: 44,
    height: 44,
  },
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "repeat(2,minmax(0,1fr)) 44px",
    "& > :not(button)": { gridColumn: "auto", gridRow: "1 / span 3" },
    "& > button": { gridColumn: 3, gridRow: 2 },
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
