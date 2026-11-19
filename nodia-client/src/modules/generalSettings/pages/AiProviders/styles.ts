import { alpha, styled } from "@mui/material/styles";
import { Box, Paper } from "@mui/material";

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
  backgroundImage: `linear-gradient(110deg, ${alpha(theme.palette.primary.main, 0.055)}, transparent 68%)`,
  boxShadow: theme.shadows[1],
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1.5),
    gap: theme.spacing(2),
  },
}));

export const HeaderTitleBox = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  flex: 1,
  minWidth: 280,
  [theme.breakpoints.down("sm")]: { minWidth: 0 },
}));

export { PageTitleContainer, PageTitle, PageSubtitle } from "../../styles";

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
    gap: theme.spacing(1),
    flexWrap: "wrap",
    flexDirection: "column",
    justifyContent: "stretch",
    "& > button": { width: "100%", minHeight: 44, whiteSpace: "normal" },
  },
}));

export const CardsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  rowGap: theme.spacing(3), // 24px vertical gap
  width: "100%",
}));
