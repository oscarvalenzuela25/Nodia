import { Box, Button, Tabs } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
export const WorkspaceAction = styled(Button)(({ theme }) => ({
  minHeight: 44,
  alignSelf: "flex-end",
  [theme.breakpoints.down("sm")]: { width: "100%" },
}));
export const WorkspaceStack = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  minWidth: 0,
}));
export const WorkspaceHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  flexWrap: "wrap",
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
  backgroundImage: `linear-gradient(110deg, ${alpha(theme.palette.primary.main, 0.07)}, transparent 65%)`,
}));

export const WorkspaceTabs = styled(Tabs)(({ theme }) => ({
  minWidth: 0,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  "& .MuiTab-root.Mui-focusVisible": { outlineOffset: -3 },
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
