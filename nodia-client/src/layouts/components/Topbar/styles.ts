import { styled } from "@mui/material/styles";

export const TopbarRoot = styled("header")(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  boxShadow: `inset 0 -1px ${theme.palette.divider}`,
  paddingBlockStart: `calc(${theme.spacing(0.75)} + env(safe-area-inset-top, 0px))`,
  paddingBlockEnd: theme.spacing(0.75),
  paddingLeft: `max(${theme.spacing(2)}, env(safe-area-inset-left, 0px))`,
  paddingRight: `max(${theme.spacing(2)}, env(safe-area-inset-right, 0px))`,
  display: "grid",
  gridTemplateColumns: "44px minmax(0, 1fr)",
  columnGap: theme.spacing(1),
  rowGap: theme.spacing(1),
  alignItems: "center",
  justifyContent: "flex-end",
  minHeight: 56,
  [theme.breakpoints.up("sm")]: {
    minHeight: 64,
    paddingInline: theme.spacing(3),
    gridTemplateColumns: "44px minmax(0, 1fr) auto",
    columnGap: theme.spacing(2),
  },
  [theme.breakpoints.up("md")]: { paddingInline: theme.spacing(4) },
  [theme.breakpoints.up("lg")]: { gridTemplateColumns: "40px minmax(0, 1fr) auto" },
}));
