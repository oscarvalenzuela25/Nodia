import { Button, IconButton } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { FlashcardPanel } from "./styles";

export const LibraryTreePanel = styled(FlashcardPanel)({
  container: "flashcard-tree / inline-size",
});

export const CompactTreeTrigger = styled(Button)(({ theme }) => ({
  justifyContent: "space-between",
  textAlign: "start",
  textTransform: "none",
  minHeight: 44,
  color: theme.palette.text.primary,
  borderColor: theme.palette.divider,
  [theme.breakpoints.up("md")]: { display: "none" },
}));

export const TreeFilters = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(1),
  "& > *": { minWidth: 0 },
  "@container flashcard-tree (min-width: 21rem)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
}));

export const TreeList = styled("ul")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(0.75),
  minWidth: 0,
  margin: 0,
  padding: 0,
  listStyle: "none",
}));

export const SetGroup = styled("li")(({ theme }) => ({
  minWidth: 0,
  padding: theme.spacing(0.25, 0.5),
  border: "1px solid " + theme.palette.divider,
  borderRadius: theme.spacing(1.25),
  backgroundColor: theme.palette.background.paper,
  "&[data-expanded='true']": {
    backgroundColor: alpha(theme.palette.secondary.main, 0.055),
  },
}));

export const SetBranch = styled(TreeList)(({ theme }) => ({
  "--branch-indent": theme.spacing(2),
  gap: 0,
  marginInlineStart: theme.spacing(2),
  marginInlineEnd: theme.spacing(0.25),
  paddingBlockEnd: theme.spacing(0.5),
  "& > li": {
    position: "relative",
    minWidth: 0,
    paddingInlineStart: "var(--branch-indent)",
    paddingBlock: theme.spacing(0.125),
  },
  "& > li::before, & > li::after": {
    content: '""',
    position: "absolute",
    insetInlineStart: 0,
    pointerEvents: "none",
  },
  "& > li::before": {
    insetBlock: 0,
    borderInlineStart: "1px solid " + theme.palette.divider,
  },
  "& > li::after": {
    inlineSize: "var(--branch-indent)",
    insetBlockStart: "50%",
    borderBlockStart: "1px solid " + theme.palette.divider,
  },
  "& > li:last-child::before": { insetBlockEnd: "50%" },
  "@media (any-pointer: coarse)": {
    marginInlineStart: theme.spacing(2.75),
  },
}));

export const TreeRow = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  minWidth: 0,
  gap: theme.spacing(0.25),
  "& > .MuiButton-root": {
    flex: "1 1 0",
    paddingInline: theme.spacing(0.5),
    gap: theme.spacing(0.75),
  },
}));

export const TreeName = styled("span")({
  minWidth: 0,
  flex: 1,
  overflowWrap: "anywhere",
  display: "grid",
});

export const TreeIconButton = styled(IconButton)(({ theme }) => ({
  flexShrink: 0,
  inlineSize: 32,
  blockSize: 36,
  color: theme.palette.text.secondary,
  "@media (any-pointer: coarse)": {
    inlineSize: 44,
    blockSize: 44,
  },
  "&.Mui-focusVisible": {
    outline: "2px solid " + theme.palette.primary.main,
    outlineOffset: -2,
  },
}));

export const TreeTrash = styled(TreeIconButton)(({ theme }) => ({
  "&:hover, &.Mui-focusVisible": {
    color: theme.palette.error.main,
    backgroundColor: alpha(theme.palette.error.main, theme.palette.action.hoverOpacity),
  },
}));

export const LibraryMark = styled("span")(({ theme }) => ({
  display: "inline-grid",
  placeItems: "center",
  inlineSize: 26,
  blockSize: 26,
  flex: "0 0 26px",
  borderRadius: theme.spacing(0.875),
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.15),
  fontSize: theme.typography.pxToRem(16),
  "&[data-kind='set']": {
    color: theme.palette.secondary.main,
    backgroundColor: alpha(theme.palette.secondary.main, 0.16),
  },
  "&[data-kind='deck']": {
    color: theme.palette.success.main,
    backgroundColor: alpha(theme.palette.success.main, 0.15),
  },
}));

export const PageControls = styled("div")({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
});
