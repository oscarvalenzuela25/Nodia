import { styled } from "@mui/material/styles";

export const TopbarRoot = styled("header")(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  padding: theme.spacing(1.5, 2),
  [theme.breakpoints.up("md")]: {
    padding: theme.spacing(2, 4),
  },
  display: "grid",
  gridTemplateColumns: "40px minmax(0, 1fr)",
  columnGap: theme.spacing(1),
  rowGap: theme.spacing(1),
  alignItems: "center",
  justifyContent: "flex-end",
  minHeight: 56,
  [theme.breakpoints.up("sm")]: {
    minHeight: 64,
    gridTemplateColumns: "40px minmax(0, 1fr) auto",
    columnGap: theme.spacing(2),
  },
}));
