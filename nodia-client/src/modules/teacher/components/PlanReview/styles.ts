import { Accordion, Box, Stack, alpha, styled } from "@mui/material";

export const ReviewHeader = styled("header")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(2), minWidth: 0,
  "& h2": { overflowWrap: "anywhere", scrollMarginBlock: theme.spacing(2) },
  "&[data-editing]": { borderBlockEnd: `1px solid ${theme.palette.divider}`, paddingBlockEnd: theme.spacing(2) },
  [theme.breakpoints.up("md")]: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap",
  },
}));
export const EditActions = styled(Box)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: theme.spacing(1), minWidth: 0,
  "& > button": {
    minHeight: 44, minWidth: 0, textWrap: "balance",
    [theme.breakpoints.down("sm")]: { paddingInline: theme.spacing(1.25) },
  },
  "& > button:last-child": { gridColumn: "1 / -1" },
  [theme.breakpoints.up("sm")]: { display: "flex", flexWrap: "wrap" },
}));
export const AdjustmentPanel = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(2), padding: theme.spacing(2), minWidth: 0,
  border: `1px solid ${theme.palette.divider}`, borderRadius: theme.spacing(2),
  background: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.045 : 0.025),
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(3) },
}));

export const ReviewSummary = styled(Box)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: theme.spacing(3),
  padding: theme.spacing(3), borderRadius: 16,
  background: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.1 : 0.05),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  [theme.breakpoints.up("md")]: { gridTemplateColumns: "minmax(0,1fr) minmax(230px, 280px)" },
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
}));
export const Decision = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(1.5), minWidth: 0,
  borderTop: `1px solid ${theme.palette.divider}`, paddingTop: theme.spacing(3),
  "& > button": { minHeight: 44 },
  [theme.breakpoints.up("md")]: { borderTop: 0, paddingTop: 0, borderLeft: `1px solid ${theme.palette.divider}`, paddingLeft: theme.spacing(3), justifyContent: "center" },
}));
export const MetricRow = styled(Stack)(({ theme }) => ({
  flexDirection: "row", flexWrap: "wrap", gap: theme.spacing(1),
  "& .MuiChip-root": { maxWidth: "100%", height: "auto", minHeight: 28 },
  "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", paddingBlock: theme.spacing(0.5) },
}));
export const OutlineSection = styled(Accordion)(({ theme }) => ({
  margin: 0, border: `1px solid ${theme.palette.divider}`, borderRadius: "12px !important",
  backgroundImage: "none", "&:before": { display: "none" }, "&.Mui-expanded": { margin: 0 },
  "& .MuiAccordionSummary-root": { minHeight: 72, padding: theme.spacing(1, 2) },
  "& .MuiAccordionSummary-content": { minWidth: 0, margin: theme.spacing(0.5, 0) },
  "& .MuiAccordionDetails-root": { padding: theme.spacing(0, 2, 2) },
}));
export const SectionSummary = styled(Box)(({ theme }) => ({ display: "flex", alignItems: "center", gap: theme.spacing(1.5), minWidth: 0, width: "100%", overflowWrap: "anywhere" }));
export const SectionNumber = styled("span")(({ theme }) => ({
  width: 32, height: 32, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 8,
  fontWeight: 600, fontSize: 14, color: theme.palette.primary.main, background: alpha(theme.palette.primary.main, 0.12),
}));
export const UnitList = styled("ol")(({ theme }) => ({ margin: theme.spacing(1, 0, 0), paddingLeft: theme.spacing(3), "& li": { paddingLeft: theme.spacing(0.5), "& + li": { marginTop: theme.spacing(1) } } }));
