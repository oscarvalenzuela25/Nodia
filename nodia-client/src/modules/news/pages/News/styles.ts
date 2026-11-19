import { styled } from "@mui/material/styles";
import { NewsMasthead } from "../../styles";

export const NewsRoot = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  minWidth: 0,
  maxWidth: 1440,
  marginInline: "auto",
  width: "100%",
  containerType: "inline-size",
  containerName: "news-editorial",
}));
export const Header = styled(NewsMasthead)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  "& > button": { width: "100%", minHeight: 44 },
  [theme.breakpoints.up("sm")]: { "& > button": { width: "auto" } },
}));

export const AdminRefreshControls = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  width: "100%",
  minWidth: 0,
  "& > *": { width: "100%", minWidth: 0 },
  "& > button": { minHeight: 44 },
  [theme.breakpoints.up("sm")]: {
    width: "auto",
    "& > *": { width: "auto" },
    "& > div": { width: 240 },
  },
}));

export const FilterBar = styled("section")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignItems: "center",
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.5),
  backgroundColor: theme.palette.background.paper,
  "@container news-editorial (min-width: 1020px)": {
    gridTemplateColumns: "minmax(0, 1fr) minmax(24rem, .9fr)",
  },
}));

export const FilterControls = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(2),
  minWidth: 0,
  "@container news-editorial (min-width: 580px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
}));

export const ReadingHeader = styled("header")(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  flexWrap: "wrap",
  gap: theme.spacing(1, 2),
  marginBottom: theme.spacing(2),
}));

// Available content width includes the sidenav and page padding.
export const ArticleGrid = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  columnGap: theme.spacing(2),
  rowGap: theme.spacing(3),
  "@container news-editorial (min-width: 580px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  "@container news-editorial (min-width: 1020px)": {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
}));
