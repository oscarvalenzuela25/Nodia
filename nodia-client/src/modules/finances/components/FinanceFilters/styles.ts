import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

export const FilterBar = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: theme.spacing(2),
  [theme.breakpoints.down("sm")]: { "& > button": { width: "100%" } },
}));

export const ActiveFilters = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  maxWidth: "100%",
  "& > div": {
    maxWidth: "100%",
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    "& button": { flexShrink: 0 },
  },
}));
