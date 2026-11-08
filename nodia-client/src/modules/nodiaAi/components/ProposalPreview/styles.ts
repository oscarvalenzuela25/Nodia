import { alpha, styled } from "@mui/material/styles";

export const Preview = styled("section")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(2.5), minWidth: 0,
  overflowWrap: "anywhere", containerType: "inline-size", containerName: "proposal-preview",
  fontSize: theme.typography.body2.fontSize, lineHeight: 1.6,
}));
export const PreviewBody = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(3), minWidth: 0,
}));
export const Summary = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`, paddingTop: theme.spacing(2.5), minWidth: 0,
}));
export const SummaryMeta = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", flexWrap: "wrap", gap: theme.spacing(1),
  "& .MuiChip-root": { fontWeight: 700 },
}));
export const Dates = styled("dl")(({ theme }) => ({
  display: "flex", flexWrap: "wrap", columnGap: theme.spacing(4), rowGap: theme.spacing(1), margin: 0,
  "& dt": { ...theme.typography.caption, color: theme.palette.text.secondary },
  "& dd": { margin: 0, ...theme.typography.body2 },
}));
export const Step = styled("article")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(2), minWidth: 0,
  border: `1px solid ${theme.palette.divider}`, borderRadius: 12,
  padding: theme.spacing(2), backgroundColor: alpha(theme.palette.background.default, 0.2),
}));
export const StepHeader = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "flex-start", gap: theme.spacing(1.5), minWidth: 0,
}));
export const StepNumber = styled("span")(({ theme }) => ({
  width: 32, height: 32, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 10,
  ...theme.typography.body2, fontWeight: 700, color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
}));
export const Context = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(0.75), minWidth: 0,
  padding: theme.spacing(1.5), borderRadius: 8, backgroundColor: theme.palette.action.hover,
  "& p": { margin: 0 },
}));
export const ChangeField = styled("div")(({ theme }) => ({
  minWidth: 0, display: "flex", flexDirection: "column", gap: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`, paddingTop: theme.spacing(2),
}));
export const Change = styled("div")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: theme.spacing(1), minWidth: 0,
  alignItems: "stretch",
  "@container proposal-preview (min-width: 560px)": {
    "&[data-comparison=true]": { gridTemplateColumns: "minmax(0, 1fr) 24px minmax(0, 1fr)", gap: theme.spacing(1.5) },
  },
}));
export const ChangeValue = styled("div")(({ theme }) => ({
  padding: theme.spacing(1.5), minWidth: 0, borderRadius: 8,
  backgroundColor: theme.palette.action.hover,
  "&[data-side=after]": {
    backgroundColor: alpha(theme.palette.primary.main, 0.07),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
  },
  "& > p": { marginBottom: theme.spacing(1), fontWeight: 700 },
}));
export const ChangeAbsence = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: theme.spacing(0.5),
  color: theme.palette.text.secondary, ...theme.typography.caption,
}));
export const ChangeArrow = styled("span")(({ theme }) => ({
  display: "grid", placeItems: "center", color: theme.palette.text.secondary,
  "& svg": { transform: "rotate(90deg)" },
  "@container proposal-preview (min-width: 560px)": { "& svg": { transform: "none" } },
}));
export const Fields = styled("dl")(({ theme }) => ({
  margin: 0, minWidth: 0, display: "grid", gap: theme.spacing(1.5),
  "& > div": { minWidth: 0 },
  "& dt": { fontWeight: 600, marginBottom: theme.spacing(0.25) },
  "& dd": { margin: 0, minWidth: 0 },
}));
export const TechnicalDetails = styled("details")(({ theme }) => ({
  minWidth: 0, borderTop: `1px solid ${theme.palette.divider}`, paddingTop: theme.spacing(1),
  "& summary": {
    cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center", gap: theme.spacing(1),
    ...theme.typography.body2, color: theme.palette.text.secondary, fontWeight: 600,
    listStyle: "none", "&::-webkit-details-marker": { display: "none" },
    "&::after": { content: '"+"', marginLeft: "auto", fontSize: 20 },
    "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 3, borderRadius: 4 },
  },
  "&[open] > summary::after": { content: '"−"' },
  "& > div": { display: "flex", flexDirection: "column", gap: theme.spacing(1), padding: theme.spacing(1, 0) },
  "& code": { fontSize: "0.75rem", overflowWrap: "anywhere", whiteSpace: "normal" },
}));
export const ReviewFooter = styled("div")(({ theme }) => ({
  minWidth: 0, paddingTop: theme.spacing(2.5), borderTop: `1px solid ${theme.palette.divider}`,
}));
export const ReviewActions = styled("div")(({ theme }) => ({
  display: "flex", flexWrap: "wrap", gap: theme.spacing(1),
  "& > button": { minHeight: 44, [theme.breakpoints.down("sm")]: { width: "100%" } },
}));
export const SwitchWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(1.5), borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`, backgroundColor: theme.palette.action.hover,
}));
