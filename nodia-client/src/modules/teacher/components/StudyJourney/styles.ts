import { Accordion, AccordionSummary, Box, Button, styled } from "@mui/material";
import { alpha } from "@mui/material/styles";

export const JourneyAccordion = styled(Accordion)({
  background: "transparent", minWidth: 0, "&:before": { display: "none" },
});
export const SectionAccordion = styled(Accordion)(({ theme }) => ({
  minWidth: 0, background: "transparent", border: `1px solid ${theme.palette.divider}`,
  borderRadius: `${theme.spacing(1.5)} !important`, overflow: "hidden",
  "&:before": { display: "none" }, "&.Mui-expanded": { margin: 0 },
}));
export const SectionSummary = styled(AccordionSummary)(({ theme }) => ({
  padding: theme.spacing(0, 1.5), minHeight: 60,
  "& .MuiAccordionSummary-content": { alignItems: "center", gap: theme.spacing(1.25), margin: theme.spacing(1.5, 0), minWidth: 0 },
  "& .MuiAccordionSummary-expandIconWrapper": { marginLeft: theme.spacing(1) },
}));
export const SectionNumber = styled(Box)(({ theme }) => ({
  ...theme.typography.caption, fontWeight: 700, fontVariantNumeric: "tabular-nums",
  width: 28, height: 28, flexShrink: 0, display: "grid", placeItems: "center",
  borderRadius: theme.spacing(.75), color: theme.palette.primary.main,
  background: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .16 : .08),
}));
export const Objectives = styled("details")(({ theme }) => ({
  minWidth: 0, borderRadius: theme.spacing(1), background: alpha(theme.palette.text.primary, .025),
  "& summary": { ...theme.typography.body2, fontWeight: 600, minHeight: 44, padding: theme.spacing(1.25), boxSizing: "border-box", cursor: "pointer" },
  "& summary:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2, borderRadius: theme.spacing(1) },
}));
export const UnitButton = styled(Button)(({ theme }) => ({
  width: "100%", minWidth: 0, minHeight: 48, justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left",
  gap: theme.spacing(.75), padding: theme.spacing(1.25), lineHeight: 1.5, textTransform: "none",
  "& .MuiButton-startIcon": { marginLeft: 0, marginRight: theme.spacing(.25), flexShrink: 0 },
}));
export const UnitOrdinal = styled("span")(({ theme }) => ({
  ...theme.typography.caption, fontVariantNumeric: "tabular-nums", opacity: .75, flexShrink: 0,
}));
export const FinalButton = styled(Button)(({ theme }) => ({
  width: "100%", minHeight: 44, marginTop: theme.spacing(.5), whiteSpace: "normal", textTransform: "none",
}));
