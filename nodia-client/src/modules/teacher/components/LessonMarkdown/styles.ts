import { alpha, styled } from "@mui/material/styles";

const codeFont = 'ui-monospace, "Cascadia Code", Consolas, monospace';

export const MarkdownContent = styled("div")({
  minWidth: 0, maxWidth: "100%", lineHeight: 1.75, overflowWrap: "anywhere",
  "& :not(pre) > code": { fontFamily: codeFont, fontSize: "0.9em" },
});

export const CodeFrame = styled("div")(({ theme }) => ({
  minWidth: 0, maxWidth: "100%", margin: theme.spacing(2, 0),
  border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius,
  background: alpha(theme.palette.text.primary, 0.035), fontFamily: codeFont,
}));

export const CodeHeader = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(1),
  minHeight: 44, padding: theme.spacing(0, 1.5), borderBottom: `1px solid ${theme.palette.divider}`,
  background: alpha(theme.palette.text.primary, 0.035),
}));

export const CodeScroll = styled("pre")(({ theme }) => {
  const base = theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.common.black;
  return {
    margin: 0, padding: theme.spacing(2), minWidth: 0, maxWidth: "100%", boxSizing: "border-box",
    overflowX: "auto", whiteSpace: "pre", overflowWrap: "normal", fontFamily: codeFont, fontSize: "0.8125rem", lineHeight: 1.7,
    scrollbarWidth: "thin", scrollbarColor: `${alpha(base, 0.2)} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
    "&::-webkit-scrollbar-thumb": { background: alpha(base, 0.2), borderRadius: 9999, border: 0,
      "&:hover": { background: alpha(base, 0.35) } },
    "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
    "& code": { display: "block", minWidth: "max-content", fontFamily: "inherit", fontSize: "inherit", padding: 0, background: "transparent" },
  };
});
