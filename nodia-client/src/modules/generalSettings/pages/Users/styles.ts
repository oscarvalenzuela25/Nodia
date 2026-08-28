import { styled } from "@mui/material/styles";
import { Box, Typography } from "@mui/material";

export const PageHeader = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
}));

export const PageTitleContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

export const PageTitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.h4,
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
}));

export const PageSubtitle = styled(Typography)(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.palette.text.secondary,
  maxWidth: "640px",
  lineHeight: 1.6,
}));

export const FilterRow = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
}));

export const ActiveFilters = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(3),
}));

export const TableTopBar = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: theme.spacing(2.5),
  gap: theme.spacing(2),
  flexWrap: "wrap",
}));

export const UserInfo = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
}));

export const StyledTableContainer = styled(Box)(({ theme }) => {
  const borderColor = theme.palette.border?.default ?? theme.palette.divider;

  return {
    borderRadius:
      typeof theme.shape.borderRadius === "number"
        ? theme.shape.borderRadius * 2
        : 16,
    overflow: "hidden",
    boxShadow: theme.shadows[2],
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${borderColor}`,
  };
});
