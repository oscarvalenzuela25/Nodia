import { Accordion, AccordionDetails, AccordionSummary, alpha, Box, styled } from "@mui/material";
export const SelectionAccordion = styled(Accordion)({ background: "transparent", "&:before": { display: "none" } });
export const Summary = styled(AccordionSummary)(({ theme }) => ({ padding: 0, minHeight: 44, "& .MuiAccordionSummary-content": { margin: theme.spacing(1, 0) } }));
export const Details = styled(AccordionDetails)({ padding: 0 });
export const Fields = styled(Box)(({ theme }) => ({ display: "grid", gap: theme.spacing(2), gridTemplateColumns: "minmax(0,1fr)", [theme.breakpoints.up("sm")]: { gridTemplateColumns: "repeat(2,minmax(0,1fr))" } }));

export const SelectionSection = styled("section")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(2.5), minWidth: 0,
}));
export const SelectionHeader = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap",
  gap: theme.spacing(2), minWidth: 0,
  "& > .MuiStack-root": { minWidth: 0, flex: "1 1 18rem" },
  "& .MuiChip-root": { maxWidth: "100%", height: "auto", minHeight: 32 },
  "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", padding: theme.spacing(.75, 1.25) },
}));

export const ComposerSelectionBar = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", flexWrap: "wrap", gap: theme.spacing(0.75),
  minWidth: 0, flex: "1 1 32rem",
  "& > .MuiAlert-root": { flexBasis: "100%", minWidth: 0 },
  "& > .MuiIconButton-root, & > span > .MuiIconButton-root": { minWidth: 44, minHeight: 44 },
}));

export const Selector = styled("div", { shouldForwardProp: prop => prop !== "compact" })<{ compact: boolean }>(({ theme, compact }) => ({
  minWidth: 0,
  "& [aria-haspopup='listbox']": {
    height: 48, minHeight: 48, boxSizing: "border-box", padding: theme.spacing(0, 1),
    "& .MuiIconButton-root": { width: 44, height: 44, minWidth: 44, minHeight: 44, padding: 0 },
  },
  ...(compact && {
    flex: "1 1 8rem", maxWidth: "16rem", position: "relative",
    "& label": {
      position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden",
      clipPath: "inset(50%)", whiteSpace: "nowrap", border: 0,
    },
    "& [aria-haspopup='listbox']": {
      height: 48, minHeight: 48, borderRadius: 999, borderWidth: 1, borderColor: "transparent",
      background: alpha(theme.palette.text.primary, 0.035), padding: theme.spacing(0, 1.25),
      "&:hover, &:focus-visible": { borderColor: alpha(theme.palette.primary.main, 0.35), background: alpha(theme.palette.primary.main, 0.06) },
      "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
      "& .MuiTypography-root": { fontSize: ".75rem", fontWeight: 500 },
    },
    [theme.breakpoints.down("sm")]: { flexBasis: "calc(50% - 8px)", maxWidth: "none" },
  }),
}));
