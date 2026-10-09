import { styled } from "@mui/material/styles";
import { Box, Paper, Typography } from "@mui/material";

export const PageContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3), // 24px vertical gap between main panels
}));

export const HeaderPanel = styled(Paper)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(3),
  padding: theme.spacing(2),
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(3) },
  [theme.breakpoints.up("md")]: { padding: theme.spacing(4) },
  borderRadius: Number(theme.shape.borderRadius) * 2,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  boxShadow:
    theme.palette.mode === "dark"
      ? "0 4px 20px 0 rgba(0, 0, 0, 0.4)"
      : "0 4px 20px 0 rgba(0, 0, 0, 0.05)",
}));

export const HeaderTitleBox = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  flex: 1,
  minWidth: 280,
  [theme.breakpoints.down("sm")]: { minWidth: 0 },
}));

export const PageTitleContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

export const PageTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: "1.5rem",
  color: theme.palette.text.primary,
}));

export const PageSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  color: theme.palette.text.secondary,
  maxWidth: "720px",
  lineHeight: 1.5,
}));

export const HeaderActionsBox = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: theme.spacing(2), // 16px gap between search/selector and buttons
  width: "auto",
  minWidth: 360,
  maxWidth: 480,
  [theme.breakpoints.down("sm")]: {
    minWidth: "100%",
    maxWidth: "100%",
    width: "100%",
    alignItems: "stretch",
  },
}));

export const HeaderButtonsRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: theme.spacing(1.5),
  flexWrap: "nowrap",
  justifyContent: "flex-end",
  width: "100%",
  "& > button": {
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  [theme.breakpoints.down("sm")]: {
    flexWrap: "wrap",
    flexDirection: "column",
    justifyContent: "stretch",
    "& > button": {
      flex: 1,
      minWidth: 140,
      width: "100%",
    },
  },
}));

export const CardsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  rowGap: theme.spacing(3), // 24px vertical gap
  width: "100%",
}));
