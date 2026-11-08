import { Box, Paper, TableContainer } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { TABLE_PANEL_RADIUS } from "../../../../../../theme/tablePanel";

export const RecordsLayout = styled(Box)(({ theme }) => ({ display: "flex", flexDirection: "column", gap: theme.spacing(3), minWidth: 0 }));
export const FilterRow = styled(Box)(({ theme }) => ({ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: theme.spacing(2), minWidth: 0, width: "100%",
  "& > button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& > button": { width: "100%" } },
}));
export const AppliedFilterRow = styled(Box)(({ theme }) => ({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: theme.spacing(1), minWidth: 0, width: "100%",
  "& > *": { maxWidth: "100%", minWidth: 0, whiteSpace: "normal", overflowWrap: "anywhere", textAlign: "left" },
  "& button": { minWidth: 44, minHeight: 44, flexShrink: 0 },
}));
export const TableTopBar = styled(Box)(({ theme }) => ({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(2), flexWrap: "wrap", minWidth: 0,
  [theme.breakpoints.down("sm")]: { alignItems: "stretch", "& > *": { width: "100%" } },
}));
export const SearchArea = styled(Box)(({ theme }) => ({ width: 320, minWidth: 0, [theme.breakpoints.down("sm")]: { width: "100%" } }));
export const RecordsPanel = styled(Paper)(({ theme }) => ({ position: "relative", borderRadius: TABLE_PANEL_RADIUS, border: `1px solid ${theme.palette.divider}`, boxShadow: "none", overflow: "hidden", minWidth: 0,
  [theme.breakpoints.down("sm")]: { background: "transparent", border: "none", overflow: "visible" },
}));
export const RecordsScroll = styled(TableContainer)(({ theme }) => {
  const thumb = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2);
  return { overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: `${thumb} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 }, "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
    "&::-webkit-scrollbar-thumb": { background: thumb, borderRadius: 9999, border: "none", "&:hover": { background: alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.35) } },
  };
});
