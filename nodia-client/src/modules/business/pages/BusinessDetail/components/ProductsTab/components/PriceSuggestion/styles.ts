import { styled } from "@mui/material/styles";
import { Box, IconButton } from "@mui/material";

const wideSuggestion = "@container price-suggestion (min-width: 280px)";

export const Suggestion = styled(Box)({ containerType: "inline-size", containerName: "price-suggestion", minWidth: 0 });

export const SuggestionLayout = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 44px",
  gap: theme.spacing(1),
  alignItems: "end",
  minWidth: 0,
  "& .MuiTypography-root": { minWidth: 0, overflowWrap: "anywhere" },
  [wideSuggestion]: {
    gridTemplateColumns: "88px minmax(0, 1fr) 44px",
  },
}));

export const MarkupField = styled(Box)({ width: 88, minWidth: 0, gridColumn: 1, gridRow: 1 });

export const PriceResult = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateRows: "auto minmax(40px, auto)",
  gap: theme.spacing(0.75),
  minWidth: 0,
  gridColumn: 1,
  gridRow: 2,
  [wideSuggestion]: { gridColumn: 2, gridRow: 1 },
}));

export const ApplyButtonSlot = styled("span")({
  display: "inline-flex",
  gridColumn: 2,
  gridRow: 2,
  [wideSuggestion]: { gridColumn: 3, gridRow: 1 },
});

export const ApplyButton = styled(IconButton)(({ theme }) => ({
  width: 44,
  height: 44,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  "&:hover": { backgroundColor: theme.palette.primary.dark },
  "&.Mui-disabled": { backgroundColor: theme.palette.action.disabledBackground, color: theme.palette.action.disabled },
}));
