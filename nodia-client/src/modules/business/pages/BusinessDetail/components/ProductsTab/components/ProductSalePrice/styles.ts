import { alpha, styled } from "@mui/material/styles";

export const Price = styled("span")(({ theme }) => ({
  display: "inline-flex",
  flexDirection: "column",
  gap: theme.spacing(0.25),
  maxWidth: "100%",
  minWidth: 0,
  overflowX: "auto",
  overflowWrap: "normal",
  wordBreak: "normal",
  fontVariantNumeric: "tabular-nums",
  scrollbarWidth: "thin",
  scrollbarColor: `${alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2)} transparent`,
  "&::-webkit-scrollbar": { width: 6, height: 6 },
  "&::-webkit-scrollbar-track": { background: "transparent !important" },
  "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
  "&::-webkit-scrollbar-thumb": { background: alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2), borderRadius: 9999, border: "none",
    "&:hover": { background: alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.35) } },
}));

export const Amount = styled("span")({
  fontSize: "16px",
  fontWeight: 700,
  whiteSpace: "normal",
});

export const OfferAmount = styled(Amount)(({ theme }) => ({
  color: theme.palette.error.main,
  fontWeight: 700,
}));
