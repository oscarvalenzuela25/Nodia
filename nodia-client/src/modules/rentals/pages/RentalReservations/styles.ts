import { Box, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
export const PageStack = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  minWidth: 0,
}));
export const PageHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  paddingBlockEnd: theme.spacing(2),
  borderBlockEnd: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.up("lg")]: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
}));
export const PagePropertyTools = styled("div")(({ theme }) => ({
  minWidth: 0,
  [theme.breakpoints.up("lg")]: { flex: "1 1 25rem" },
}));
export const PageTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h4,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  minWidth: 0,
  overflowWrap: "anywhere",
  fontSize: "1.5rem",
  [theme.breakpoints.up("sm")]: { fontSize: "1.875rem" },
  [theme.breakpoints.up("md")]: { fontSize: "2.125rem" },
  "& > .MuiSvgIcon-root": {
    boxSizing: "border-box",
    width: 44,
    height: 44,
    flexShrink: 0,
    padding: theme.spacing(1.25),
    borderRadius: 12,
    backgroundColor: alpha(theme.palette.primary.main, 0.10),
  },
}));
