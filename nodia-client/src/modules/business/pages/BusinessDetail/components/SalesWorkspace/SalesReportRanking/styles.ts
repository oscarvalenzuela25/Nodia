import { Paper } from "@mui/material";
import { styled } from "@mui/material/styles";
import { TABLE_PANEL_RADIUS } from "../../../../../../../theme/tablePanel";
export const RankingPanel = styled(Paper)(({ theme }) => ({ minWidth: 0, overflow: "hidden", border: `1px solid ${theme.palette.divider}`, borderRadius: TABLE_PANEL_RADIUS, boxShadow: theme.shadows[2],
  [theme.breakpoints.down("sm")]: { background: "transparent", border: 0, borderRadius: 0, boxShadow: "none", overflow: "visible" },
}));
export const MobileRankingList = styled("ol")(({ theme }) => ({ display: "grid", gap: theme.spacing(2), listStyle: "none", margin: 0, padding: 0, minWidth: 0,
  "& > li": { minWidth: 0 },
}));
