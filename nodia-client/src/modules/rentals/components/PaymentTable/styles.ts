import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
export const FilterRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
  "& > *": { minWidth: 160, flex: "1 1 180px" },
}));
export const DetailFields = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  overflowWrap: "anywhere",
}));
