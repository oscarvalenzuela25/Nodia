import { styled } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";

export const FilterHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: theme.spacing(2),
}));

export const FilterTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle1,
  fontWeight: theme.typography.fontWeightMedium,
}));

export const FilterActions = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: theme.spacing(3),
}));
