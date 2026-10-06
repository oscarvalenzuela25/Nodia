import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
export const SelectorPanel = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: theme.spacing(2),
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "minmax(240px, 1fr) auto",
    "& > p, & > .MuiAlert-root": { gridColumn: "1 / -1" },
  },
}));
