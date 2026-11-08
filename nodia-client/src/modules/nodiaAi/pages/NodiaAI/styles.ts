import { alpha, styled, type CSSObject, type Theme } from "@mui/material/styles";

export const PageTitle = styled("h1")(({ theme }) => ({
  fontFamily: '"Karmatic Arcade", monospace, sans-serif',
  fontWeight: 400,
  fontSize: "2.125rem",
  lineHeight: 1.25,
  margin: 0,
  display: "inline-block",
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.tertiary?.main ?? theme.palette.secondary.main} 100%)`,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  [theme.breakpoints.down("sm")]: { fontSize: "1.5rem" },
}));

export const Page = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  minWidth: 0,
  overflowWrap: "anywhere",
}));

export const Header = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  [theme.breakpoints.down("sm")]: {
    alignItems: "stretch",
    flexDirection: "column",
  },
}));
export const Actions = styled("div")(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  flexWrap: "wrap",
  "& button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    alignItems: "stretch",
    "& button": { width: "100%", minWidth: 0, fontSize: "0.75rem" },
  },
}));
export const Workspace = styled("div")(({ theme }) => ({
  display: "flex",
  minWidth: 0,
  gap: theme.spacing(2),
  height: "calc(100dvh - 13rem)",
  minHeight: 580,
  maxHeight: 1200,
  [theme.breakpoints.down("sm")]: { height: "calc(100dvh - 18rem)", minHeight: 520, maxHeight: "none" },
}));
const scrollAreaStyles = (theme: Theme): CSSObject => {
  const thumb = alpha(
    theme.palette.mode === "dark" ? "#ffffff" : "#000000",
    0.2,
  );
  return {
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: `${thumb} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": {
      display: "none !important",
      width: 0,
      height: 0,
    },
    "&::-webkit-scrollbar-thumb": {
      background: thumb,
      borderRadius: 9999,
      border: 0,
      "&:hover": {
        background: alpha(
          theme.palette.mode === "dark" ? "#ffffff" : "#000000",
          0.35,
        ),
      },
    },
  };
};
export const ScrollArea = styled("div")(({ theme }) => scrollAreaStyles(theme));
export const History = styled(ScrollArea)(({ theme }) => ({
  width: 260,
  flexShrink: 0,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 20,
  padding: theme.spacing(2),
  background: theme.palette.background.paper,
}));
export const Chat = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 24,
  background: theme.palette.background.paper,
  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.14 : 0.025)}`,
}));
export const ChatHeading = styled("div")(({ theme }) => ({
  position: "relative",
  padding: theme.spacing(2, 3),
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(1.5, 2) },
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  gap: theme.spacing(1),
}));
export const Messages = styled(ScrollArea)(({ theme }) => ({
  flex: 1,
  overflowAnchor: "none",
  minHeight: 180,
  padding: theme.spacing(3),
  background: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.025 : 0.018),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(2, 1.25),
    minHeight: 160,
  },
}));
