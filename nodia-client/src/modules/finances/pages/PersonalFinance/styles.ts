import { Box, Tabs, Typography } from "@mui/material";
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
  [theme.breakpoints.up("md")]: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
}));
export const PageTitleContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  minWidth: 0,
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
export const PageTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h4,
  fontSize: "1.5rem",
  fontWeight: theme.typography.fontWeightBold,
  overflowWrap: "anywhere",
  [theme.breakpoints.up("sm")]: { fontSize: "1.875rem" },
  [theme.breakpoints.up("md")]: { fontSize: "2.125rem" },
}));
export const OwnerControl = styled(Box)(({ theme }) => ({
  minWidth: 0,
  width: "100%",
  maxWidth: "28rem",
  [theme.breakpoints.up("md")]: {
    flex: "0 1 28rem",
  },
}));

export const FinanceTabs = styled(Tabs)(({ theme }) => ({
  minWidth: 0,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  "& .MuiTab-root": {
    minHeight: 44,
    "&.Mui-focusVisible": { outlineOffset: -3 },
  },
  "& .MuiTabs-scrollButtons": { width: 44 },
  "& .MuiTab-root[aria-selected=true]": {
    backgroundColor: alpha(theme.palette.primary.main, 0.09),
  },
  "& .MuiTab-root[aria-selected=true]:not(.Mui-disabled)": {
    color: theme.palette.text.primary,
  },
  "& .MuiTabs-indicator": {
    backgroundColor: "transparent",
    borderBlockEnd: `3px solid ${theme.palette.primary.main}`,
    borderRadius: "3px 3px 0 0",
    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
  },
}));
