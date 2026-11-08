import { alpha, styled } from "@mui/material/styles";

export const AttachmentPanel = styled("section")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1.5), minWidth: 0,
  gridColumn: "1 / -1", overflowWrap: "anywhere",
  "& > *": { flexShrink: 0 },
  "& button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& button:not(.MuiIconButton-root)": { width: "100%" } },
}));
export const AttachmentCard = styled("article")(({ theme }) => ({
  minWidth: 0, padding: theme.spacing(1.5), border: `1px solid ${theme.palette.divider}`,
  borderRadius: 14, display: "flex", flexDirection: "column", gap: theme.spacing(1),
  overflowWrap: "anywhere",
  "& button": { minHeight: 44 },
  "& button:not(.MuiIconButton-root)": { [theme.breakpoints.down("sm")]: { width: "100%" } },
}));

export const AttachmentHeader = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", gap: theme.spacing(1.5), minWidth: 0,
  "& > span": { flexShrink: 0, alignSelf: "flex-start" },
  [theme.breakpoints.down("sm")]: { gap: theme.spacing(1) },
}));

export const PreviewFrame = styled("div")(({ theme }) => ({
  width: 64, height: 64, flexShrink: 0, overflow: "hidden", borderRadius: 10,
  display: "grid", placeItems: "center", background: alpha(theme.palette.text.primary, 0.035),
  border: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down("sm")]: { width: 52, height: 52 },
}));
