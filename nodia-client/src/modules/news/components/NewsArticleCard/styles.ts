import { alpha, styled } from "@mui/material/styles";

export const Article = styled("article")(({ theme }) => ({
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.5),
  backgroundColor: theme.palette.background.paper,
  overflowWrap: "anywhere",
  transition: theme.transitions.create("border-color", { duration: 150 }),
  "&:hover, &:focus-within": { borderColor: theme.palette.primary.main },
  "& a:focus-visible": { outline: "2px solid CanvasText", outlineOffset: 3 },
  "&[data-leading=true]": {
    borderBlockStartColor: theme.palette.primary.main,
    borderBlockStartWidth: 3,
    backgroundImage: `linear-gradient(155deg, ${alpha(theme.palette.primary.main, 0.055)}, transparent 60%)`,
  },
  "&[data-leading=true] h3": { fontSize: "1.75rem", maxWidth: "40ch" },
  "@container news-editorial (min-width: 580px)": {
    "&[data-leading=true]": { gridColumn: "span 2" },
    "&[data-leading=true] h3": { fontSize: "2rem" },
  },
  "@media (prefers-reduced-motion: reduce)": { transition: "none" },
}));

export const ArticleMetadata = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1, 1.5),
  color: theme.palette.text.secondary,
}));

export const SourceBadge = styled("span")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  padding: theme.spacing(0.25, 1),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.primary.main, 0.075),
  color: theme.palette.text.primary,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: 650,
}));

export const TopicTag = styled("span")(({ theme }) => ({
  padding: theme.spacing(0.25, 0.75),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.secondary,
  fontSize: theme.typography.caption.fontSize,
}));
