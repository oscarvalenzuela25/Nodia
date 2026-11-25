import { Button, IconButton } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

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
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: theme.spacing(1),
  "& > *": { minWidth: 0 },
}));

export const TreeList = styled("ul")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(0.5),
  minWidth: 0,
  margin: 0,
  padding: 0,
  listStyle: "none",
}));

export const SetBranch = styled(TreeList)(({ theme }) => ({
  marginInlineStart: theme.spacing(0.75),
  paddingInlineStart: theme.spacing(0.75),
  borderInlineStart: "1px solid " + theme.palette.divider,
  marginTop: theme.spacing(0.5),
}));

export const TreeRow = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
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
  "@media (pointer: coarse)": {
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
