import { alpha, styled, type Theme } from "@mui/material/styles";

const localScroll = (theme: Theme) => {
  const base = theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.common.black;
  return {
    overflowX: "auto" as const,
    scrollbarWidth: "thin" as const,
    scrollbarColor: `${alpha(base, 0.2)} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
    "&::-webkit-scrollbar-thumb": { background: alpha(base, 0.2), borderRadius: 9999, border: 0,
      "&:hover": { background: alpha(base, 0.35) } },
    "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  };
};

export const MarkdownContent = styled("div")(({ theme }) => ({
  ...theme.typography.body2, fontSize: "0.9375rem", lineHeight: 1.7, color: "inherit",
  minWidth: 0, maxWidth: "100%", whiteSpace: "normal", overflowWrap: "anywhere",
  "& > :first-child": { marginTop: 0 },
  "& > :last-child": { marginBottom: 0 },
  "& p": { margin: theme.spacing(0, 0, 1.5) },
  "& h3, & h4, & h5, & h6": { fontWeight: 700, lineHeight: 1.4, margin: theme.spacing(2, 0, 1), color: "inherit" },
  "& h3": { fontSize: "1.2rem" }, "& h4": { fontSize: "1.075rem" }, "& h5, & h6": { fontSize: "1rem" },
  "& ul, & ol": { margin: theme.spacing(0, 0, 1.5), paddingLeft: theme.spacing(3) },
  "& li + li": { marginTop: theme.spacing(0.5) },
  "& li > p": { marginBottom: theme.spacing(0.5) },
  "& .contains-task-list": { listStyle: "none", paddingLeft: 0 },
  "& input[type=checkbox]": { marginRight: theme.spacing(1), accentColor: theme.palette.primary.main },
  "& blockquote": { margin: theme.spacing(1.5, 0), padding: theme.spacing(1, 1.5),
    borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.45)}`, background: alpha(theme.palette.primary.main, 0.045), borderRadius: 6,
    "& > :last-child": { marginBottom: 0 } },
  "& a": { color: theme.palette.primary.main, textDecoration: "underline", textUnderlineOffset: "3px",
    "&:hover": { color: theme.palette.primary.dark },
    "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2, borderRadius: 2 } },
  "& code": { fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace', fontSize: "0.875em", padding: "2px 5px",
    borderRadius: 4, background: alpha(theme.palette.text.primary, 0.065) },
  "& hr": { border: 0, borderTop: `1px solid ${theme.palette.divider}`, margin: theme.spacing(2, 0) },
}));

export const TableScroll = styled("div")(({ theme }) => ({
  ...localScroll(theme), minWidth: 0, maxWidth: "100%", margin: theme.spacing(1.5, 0), borderRadius: 10,
  border: `1px solid ${theme.palette.divider}`,
  "& table": { borderCollapse: "separate", borderSpacing: 0, width: "max-content", minWidth: 650 },
  "& th, & td": { padding: theme.spacing(1, 1.5), maxWidth: "24rem", textAlign: "left", verticalAlign: "top", lineHeight: 1.6,
    borderBottom: `1px solid ${theme.palette.divider}`, overflowWrap: "anywhere" },
  "& th": { fontWeight: 700, background: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.065) },
  "& tbody tr:nth-of-type(even)": { background: alpha(theme.palette.text.primary, 0.025) },
  "& tbody tr:last-child td": { borderBottom: 0 },
}));

export const CodeBlock = styled("pre")(({ theme }) => ({
  ...localScroll(theme), minWidth: 0, maxWidth: "100%", boxSizing: "border-box", margin: theme.spacing(1.5, 0), padding: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`, borderRadius: 10, background: alpha(theme.palette.text.primary, 0.045),
  fontSize: "0.8125rem", lineHeight: 1.65,
  "& code": { display: "block", minWidth: "max-content", padding: 0, background: "transparent", borderRadius: 0,
    whiteSpace: "pre", overflowWrap: "normal", fontSize: "inherit" },
}));
