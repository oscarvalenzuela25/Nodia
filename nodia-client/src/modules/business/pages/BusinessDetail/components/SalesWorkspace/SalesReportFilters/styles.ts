import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
export const FilterBar = styled(Box)(({ theme }) => ({ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: theme.spacing(2), minWidth: 0,
  "& > button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& > button": { width: "100%" } },
}));
export const AppliedFilters = styled(Box)(({ theme }) => ({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: theme.spacing(1), minWidth: 0, maxWidth: "100%",
  "& > *": { overflowWrap: "anywhere", whiteSpace: "normal", textAlign: "left", minWidth: 0, maxWidth: "100%" },
}));
