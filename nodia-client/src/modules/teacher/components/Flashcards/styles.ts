import { Button, Stack } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const FlashcardWorkspace = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignItems: "start",
  gap: theme.spacing(3, 2),
  minWidth: 0,
  [theme.breakpoints.up("md")]: {
    gridTemplateColumns: "minmax(236px, 280px) minmax(0, 1fr)",
  },
}));

export const FlashcardPanel = styled("section")(({ theme }) => ({
  minWidth: 0,
  padding: theme.spacing(2),
  borderRadius: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  border: "1px solid " + theme.palette.divider,
  overflowWrap: "anywhere",
}));

export const FlashcardDetailPanel = styled(FlashcardPanel)({
  container: "flashcard-detail / inline-size",
});

export const FlashcardDetailHeader = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gridTemplateAreas: '"summary trash" "actions actions"',
  alignItems: "center",
  gap: theme.spacing(1.5),
  "@container flashcard-detail (min-width: 34rem)": {
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    gridTemplateAreas: '"summary actions trash"',
  },
  "&:not(:has([data-flashcard-detail-trash]))": { columnGap: theme.spacing(0.75) },
}));

export const FlashcardHeader = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  minWidth: 0,
  "& > *": { minWidth: 0 },
}));

export const FlashcardActions = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  alignItems: "stretch",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  "& > .MuiButton-root": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    "& > .MuiButton-root": { width: "100%" },
  },
}));

export const DeckButton = styled(Button)(({ theme }) => ({
  justifyContent: "flex-start",
  width: "100%",
  minHeight: 44,
  minWidth: 0,
  gap: theme.spacing(1),
  padding: theme.spacing(0.75, 1),
  textAlign: "start",
  textTransform: "none",
  borderColor: "transparent",
  color: theme.palette.text.primary,
  "&:hover": { backgroundColor: theme.palette.action.hover, borderColor: theme.palette.divider },
  "&[aria-pressed='true']": {
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    color: theme.palette.text.primary,
    borderColor: theme.palette.primary.main,
  },
  "&.Mui-focusVisible": { outline: "2px solid", outlineOffset: -2, outlineColor: theme.palette.primary.main },
}));

export const DeckCount = styled("span")(({ theme }) => ({
  marginInlineStart: "auto",
  flexShrink: 0,
  backgroundColor: theme.palette.action.selected,
  color: theme.palette.text.primary,
  padding: theme.spacing(0.25, 0.85),
  borderRadius: 999,
  fontVariantNumeric: "tabular-nums",
  fontSize: theme.typography.body2.fontSize,
}));

export const FlashcardMediaFields = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, .8fr) minmax(0, 1fr)",
  alignItems: "stretch",
  gap: theme.spacing(1),
  minWidth: 0,
  [theme.breakpoints.up("sm")]: { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" },
}));

export const FlashcardMediaPreview = styled("figure")(({ theme }) => ({
  position: "relative",
  minWidth: 0,
  margin: 0,
  minHeight: 0,
  border: "1px solid " + theme.palette.divider,
  borderRadius: theme.spacing(1.5),
  overflow: "hidden",
  backgroundColor: theme.palette.action.hover,
  "& > img": {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
}));

export const FlashcardStudySurface = styled(FlashcardPanel)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  textAlign: "start",
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(3) },
}));

export const FlashcardReviewLayout = styled("section")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  width: "100%",
  maxWidth: 640,
  minWidth: 0,
  marginInline: "auto",
  overflowWrap: "anywhere",
}));
