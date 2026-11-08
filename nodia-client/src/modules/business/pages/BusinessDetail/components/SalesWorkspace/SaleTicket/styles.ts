import { styled } from "@mui/material/styles";

// The preview represents physical thermal paper, independent of the app theme.
export const Paper = styled("article")(({ theme }) => ({
  boxSizing: "border-box", width: "80mm", maxWidth: "100%", margin: "0 auto", padding: theme.spacing(2),
  color: theme.palette.common.black, background: theme.palette.common.white,
  borderRadius: theme.spacing(1), boxShadow: theme.shadows[3],
  fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: ".8125rem", lineHeight: 1.55,
  overflowWrap: "anywhere",
  "& h3, & p": { margin: 0 },
  "& h3": { fontSize: "1.05rem", fontWeight: 800, textAlign: "center" },
  "& header": { display: "grid", gap: theme.spacing(.75), textAlign: "center", paddingBottom: theme.spacing(1.5) },
  "& ul": { listStyle: "none", margin: 0, padding: 0, borderTop: "1px dashed currentColor" },
  "& li": { display: "grid", gap: theme.spacing(.5), padding: theme.spacing(1.25, 0), borderBottom: "1px dashed currentColor" },
  "& footer": { display: "grid", gap: theme.spacing(1), paddingTop: theme.spacing(1.5), fontSize: ".75rem", textAlign: "center" },
}));
export const AmountRow = styled("div")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr)", alignItems: "start", gap: theme.spacing(.75),
  fontSize: "1.0625rem", fontWeight: 700, lineHeight: 1.4, fontVariantNumeric: "tabular-nums",
  "& > *": { minWidth: 0, maxWidth: "100%" },
  "& > :last-child": { textAlign: "right", fontWeight: 800 },
}));
export const QuantityPrice = styled("div")(({ theme }) => ({
  display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: theme.spacing(.5),
  "& > span": { minWidth: 0, maxWidth: "100%" },
}));
export const Total = styled(AmountRow)(({ theme }) => ({
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", paddingTop: theme.spacing(1.5), fontWeight: 800, fontSize: "1.125rem", lineHeight: 1.4,
}));
