import { Box, Paper, TableContainer, TableRow } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { TABLE_PANEL_RADIUS } from "../../../../../../theme/tablePanel";
import type { CashMovementType } from "../../../../infrastructure/cashTypes";

export const CashLayout = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(3),
  minWidth: 0,
}));

export const CashToolbar = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "stretch",
    "& > button": { width: "100%" },
  },
}));

export const CashToolbarActions = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    display: "grid",
    "& > button": { width: "100%", minHeight: 44 },
  },
}));

export const AppliedFilters = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing(1),
  minWidth: 0,
}));

export const TotalsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: theme.spacing(2),
  minWidth: 0,
}));

export const TotalCard = styled(Paper)(({ theme }) => ({
  minWidth: 0,
  display: "grid",
  alignContent: "start",
  gap: theme.spacing(0.75),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(2),
  boxShadow: "none",
  overflowWrap: "anywhere",
}));

export const CashRecordsPanel = styled(Paper)(({ theme }) => ({
  position: "relative",
  borderRadius: TABLE_PANEL_RADIUS,
  border: `1px solid ${theme.palette.divider}`,
  boxShadow: "none",
  overflow: "hidden",
  minWidth: 0,
  [theme.breakpoints.down("sm")]: {
    background: "transparent",
    border: "none",
    overflow: "visible",
  },
}));

export const SearchArea = styled(Box)(({ theme }) => ({
  width: 320,
  maxWidth: "100%",
  minWidth: 0,
  [theme.breakpoints.down("sm")]: { width: "100%" },
}));

export const CashCards = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  minWidth: 0,
}));

export const CashTableScroll = styled(TableContainer)(({ theme }) => {
  const base = theme.palette.mode === "dark" ? "#ffffff" : "#000000";
  const thumb = alpha(base, 0.2);
  return {
    overflowX: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: `${thumb} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
    "&::-webkit-scrollbar-thumb": {
      background: thumb,
      borderRadius: 9999,
      border: "none",
      "&:hover": { background: alpha(base, 0.35) },
    },
  };
});

function movementSurface(theme: Theme, tone: CashMovementType, inactive: boolean) {
  const color = theme.palette[tone === "income" ? "success" : "error"].main;
  const dark = theme.palette.mode === "dark";
  const tint = inactive ? 0.045 : dark ? 0.13 : 0.075;
  return {
    backgroundColor: alpha(color, tint),
    "&.MuiTableRow-hover:hover, &:hover, &:focus-within": {
      backgroundColor: alpha(color, tint + 0.045),
    },
  };
}

type MovementSurfaceProps = { tone: CashMovementType; inactive: boolean };
const movementProp = (prop: PropertyKey) => prop !== "tone" && prop !== "inactive";

export const CashMovementRow = styled(TableRow, { shouldForwardProp: movementProp })<MovementSurfaceProps>(
  ({ theme, tone, inactive }) => movementSurface(theme, tone, inactive),
);

export const CashMobileRecordSurface = styled(Box, { shouldForwardProp: movementProp })<MovementSurfaceProps>(
  ({ theme, tone, inactive }) => ({ "& > article": movementSurface(theme, tone, inactive), minWidth: 0 }),
);
