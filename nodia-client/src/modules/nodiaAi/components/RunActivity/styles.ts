import { alpha, styled } from "@mui/material/styles";

export const Mark = styled("div")(({ theme }) => ({
  display: "grid", placeItems: "center", flexShrink: 0, width: 32, height: 32,
  marginTop: theme.spacing(0.5), borderRadius: 11,
  fontFamily: '"Karmatic Arcade", monospace, sans-serif', fontSize: "1.125rem",
  color: theme.palette.primary.main, background: alpha(theme.palette.primary.main, 0.12),
  [theme.breakpoints.down("sm")]: { width: 26, height: 30, fontSize: "1rem" },
}));
export const Summary = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", flexWrap: "wrap", gap: theme.spacing(1), minWidth: 0,
  "@media (prefers-reduced-motion: reduce)": { ".MuiCircularProgress-root, .MuiCircularProgress-circle": { animation: "none" } },
}));
export const Steps = styled("ol")(({ theme }) => ({
  listStyle: "none", margin: theme.spacing(1.5, 0, 0, 0.75), padding: theme.spacing(0, 0, 0, 2),
  borderLeft: `1px solid ${theme.palette.divider}`, display: "flex", flexDirection: "column", gap: theme.spacing(1),
}));
export const Step = styled("li")(({ theme }) => ({
  ...theme.typography.caption, color: theme.palette.text.secondary, overflowWrap: "anywhere",
  "&[aria-current=step]": { color: theme.palette.text.primary },
}));
