import { alpha, styled } from "@mui/material/styles";

export const PersonalRoot = styled("section")(({ theme }) => ({
  display: "grid",
  alignContent: "start",
  gap: theme.spacing(4),
  maxWidth: 1120,
  marginInline: "auto",
  minWidth: 0,
  containerType: "inline-size",
  containerName: "personal-news",
  "& h1, & h2, & h3, & p": { overflowWrap: "anywhere" },
}));

export const PanelToggle = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  width: "100%",
  minHeight: 52,
  padding: theme.spacing(1.25, 2),
  textAlign: "start",
  font: "inherit",
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  cursor: "pointer",
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
  "& svg": { flexShrink: 0 },
  "&[aria-expanded='true'] svg": { transform: "rotate(90deg)" },
}));

export const PanelBody = styled("div")(({ theme }) => ({
  display: "grid",
  minWidth: 0,
  gap: theme.spacing(2),
  marginBlockStart: theme.spacing(2),
  "&[hidden]": { display: "none" },
}));

export const SourceGrid = styled("div")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  gridTemplateColumns: "minmax(0, 1fr)",
  "@container personal-news (min-width: 620px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
}));

export const SourceCard = styled("article")(({ theme }) => ({
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper,
}));

export const ProviderMark = styled("span")(({ theme }) => ({
  display: "inline-grid",
  placeItems: "center",
  inlineSize: theme.spacing(5.5),
  blockSize: theme.spacing(5.5),
  flexShrink: 0,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.default,
  fontSize: theme.typography.caption.fontSize,
  fontWeight: 750,
}));

export const SourceActions = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  marginTop: "auto",
  "& > button": { width: "100%", minHeight: 44 },
  [theme.breakpoints.up("sm")]: { "& > button": { width: "auto" } },
}));

export const ReadingFilters = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(2),
  width: "100%",
  "@container personal-news (min-width: 620px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 240px))",
    justifyContent: "end",
    "& > :only-child": { gridColumn: 2 },
  },
}));

export const EmptyReading = styled("div")(({ theme }) => ({
  display: "grid",
  justifyItems: "center",
  rowGap: theme.spacing(1),
  padding: theme.spacing(4, 2),
  textAlign: "center",
  border: `1px dashed ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));

export const PersonalArticleList = styled("ul")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(2),
  padding: 0,
  margin: 0,
  listStyle: "none",
  "& > li": { minWidth: 0 },
  "@container personal-news (min-width: 620px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  "@container personal-news (min-width: 950px)": {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
}));

export const ArticleCardLink = styled("a")(({ theme }) => ({
  display: "block",
  height: "100%",
  minWidth: 0,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  textDecoration: "none",
  "&:hover": { borderColor: theme.palette.primary.main },
  "&:hover h3 span": { textDecoration: "underline" },
  "&:focus-visible": {
    borderColor: theme.palette.primary.main,
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const ArticleCard = styled("article")({
  borderRadius: "inherit",
  height: "100%",
});

export const ArticleMedia = styled("div")(({ theme }) => ({
  position: "relative",
  display: "grid",
  placeItems: "center",
  aspectRatio: "16 / 9",
  overflow: "hidden",
  borderStartStartRadius: "inherit",
  borderStartEndRadius: "inherit",
  borderBlockEnd: `1px solid ${theme.palette.divider}`,
  color: theme.palette.primary.main,
  backgroundColor: theme.palette.background.default,
  backgroundImage: `radial-gradient(ellipse at 22% 5%, ${alpha(theme.palette.primary.main, 0.22)}, transparent 64%),
    radial-gradient(ellipse at 86% 96%, ${alpha(theme.palette.primary.main, 0.15)}, transparent 56%)`,
  "& img": {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
}));

export const ArticleMediaMark = styled("span")(({ theme }) => ({
  display: "grid",
  placeItems: "center",
  width: theme.spacing(7),
  height: theme.spacing(7),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
  backgroundColor: alpha(theme.palette.background.paper, 0.64),
  "& svg": { fontSize: 30 },
}));

export const ArticleCopy = styled("header")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(0.75),
  minWidth: 0,
  padding: theme.spacing(1.5, 2, 2),
  "& h3": {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(0.5),
    color: theme.palette.primary.main,
    overflowWrap: "anywhere",
  },
  "& h3 span": { minWidth: 0 },
  "& svg": { flexShrink: 0, fontSize: "1em", marginBlockStart: theme.spacing(0.25) },
}));
