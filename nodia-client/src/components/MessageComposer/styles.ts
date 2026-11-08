import { alpha, styled } from "@mui/material/styles";

export const ComposerShell = styled("form")(({ theme }) => ({
  margin: theme.spacing(0, 2, 2),
  padding: theme.spacing(1.5),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
  borderRadius: 22,
  background: theme.palette.background.paper,
  boxShadow: `0 4px 24px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.16 : 0.04)}`,
  display: "flex", flexDirection: "column", gap: theme.spacing(1), minWidth: 0,
  flex: "0 1 auto", minHeight: 0, maxHeight: "min(60dvh, 30rem)",
  "& > *": { flexShrink: 0 },
  "& > [data-composer-review]": { display: "flex", flexDirection: "column", flex: "0 1 auto", minHeight: 0 },
  "&:focus-within": { borderColor: alpha(theme.palette.primary.main, 0.6) },
  [theme.breakpoints.down("sm")]: { margin: theme.spacing(0, 1, 1), padding: theme.spacing(1), borderRadius: 18 },
}));

export const InputRow = styled("div")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "end", gap: theme.spacing(1), minWidth: 0,
  "& > button": { width: 44, height: 44, flexShrink: 0, borderRadius: 14 },
}));

export const MessageInput = styled("div")(({ theme }) => ({
  minWidth: 0,
  "& label": { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" },
  "& .MuiOutlinedInput-notchedOutline": { border: 0 },
  "& .MuiInputBase-root": { background: "transparent", padding: theme.spacing(1.25, 0.5), minHeight: 44 },
  "& .MuiInputBase-root textarea": { lineHeight: 1.6, padding: 0 },
}));

export const Toolbar = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "flex-start", gap: theme.spacing(0.5), minWidth: 0,
  borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}`, paddingTop: theme.spacing(0.75),
  "& > button": { width: 44, height: 44, borderRadius: 12, flexShrink: 0 },
  "& > [data-composer-footer]": { flex: 1, minWidth: 0 },
}));

