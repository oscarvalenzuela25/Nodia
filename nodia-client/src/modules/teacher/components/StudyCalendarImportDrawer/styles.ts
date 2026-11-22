import { Accordion } from "@mui/material";
import { alpha, styled, type Theme } from "@mui/material/styles";
import { AdaptiveDrawer } from "../AdaptiveWorkspace/styles";

function scrollArea(theme: Theme) {
  const color = theme.palette.mode === "dark" ? "#ffffff" : "#000000";
  const thumb = alpha(color, 0.2);
  return {
    overflowY: "auto" as const,
    overscrollBehaviorY: "contain" as const,
    scrollbarWidth: "thin" as const,
    scrollbarColor: thumb + " transparent",
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
    "&::-webkit-scrollbar-thumb": { background: thumb, borderRadius: 9999, border: 0,
      "&:hover": { background: alpha(color, 0.35) } },
  };
}

export const ImportDrawer = styled(AdaptiveDrawer)(({ theme }) => ({
  "& .MuiDrawer-paper": {
    width: "min(100%, 672px)",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    padding: 0,
    gap: 0,
    overflow: "hidden",
    [theme.breakpoints.up("sm")]: { padding: 0 },
  },
}));

export const Heading = styled("header")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2, 2, 0.5),
  "& h2": { fontWeight: 700, minWidth: 0, overflowWrap: "anywhere" },
  "& button": { flex: "0 0 auto", width: 44, height: 44 },
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(2.5, 3, 0.5) },
}));

export const Body = styled("div")(({ theme }) => ({
  ...scrollArea(theme),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  minHeight: 0,
  padding: theme.spacing(2),
  scrollPaddingBlock: theme.spacing(2),
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(2, 3) },
}));

export const PasteField = styled("div")(({ theme }) => ({
  minWidth: 0,
  "& textarea": {
    fontFamily: "ui-monospace, Consolas, monospace",
    lineHeight: 1.55,
    fontSize: theme.typography.pxToRem(16),
  },
  [theme.breakpoints.up("sm")]: { "& textarea": { fontSize: theme.typography.pxToRem(14) } },
}));

export const Tools = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  "& button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& button": { width: "100%" } },
}));

export const Actions = styled(Tools)(({ theme }) => ({
  justifyContent: "flex-end",
  backgroundColor: theme.palette.background.paper,
  padding: theme.spacing(1.5, 2, 2),
  paddingBottom: "max(" + theme.spacing(2) + ", env(safe-area-inset-bottom))",
  [theme.breakpoints.up("sm")]: {
    padding: theme.spacing(1.5, 3, 2.5),
    paddingBottom: "max(" + theme.spacing(2.5) + ", env(safe-area-inset-bottom))",
  },
}));

export const ReviewContent = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  minWidth: 0,
  overflowWrap: "anywhere",
  "& .MuiChip-root": { maxWidth: "100%", height: "auto", minHeight: 24 },
  "& .MuiChip-label": { whiteSpace: "normal" },
}));

export const Summary = styled("div")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(0.5),
  padding: theme.spacing(2),
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.shape.borderRadius,
}));

export const PreviewDay = styled(Accordion)(({ theme }) => ({
  border: "1px solid " + theme.palette.divider,
  borderRadius: theme.shape.borderRadius,
  "&::before": { display: "none" },
  "& .MuiAccordionSummary-root": { minHeight: 54, paddingInline: theme.spacing(2) },
  "& .MuiAccordionSummary-content": { minWidth: 0, marginBlock: theme.spacing(1.25) },
  "& .MuiAccordionDetails-root": { padding: theme.spacing(0, 2, 1.75) },
}));

export const CopyFallback = styled("pre")(({ theme }) => ({
  ...scrollArea(theme),
  margin: 0,
  padding: theme.spacing(1),
  maxHeight: "15rem",
  backgroundColor: theme.palette.action.hover,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
}));

export const ActivityList = styled("ol")(({ theme }) => ({
  margin: 0,
  paddingInlineStart: theme.spacing(2.5),
  overflowWrap: "anywhere",
  "& li + li": { marginTop: theme.spacing(1.25) },
  "& li::marker": { color: theme.palette.text.secondary },
}));
