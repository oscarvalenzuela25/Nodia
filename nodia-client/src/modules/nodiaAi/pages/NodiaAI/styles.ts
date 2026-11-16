import { alpha, styled, type CSSObject, type Theme } from "@mui/material/styles";

export const PageTitle = styled("h1")(({ theme }) => ({
  fontFamily: '"Karmatic Arcade", monospace, sans-serif',
  fontWeight: 400,
  fontSize: "34px",
  lineHeight: 1.25,
  margin: 0,
  display: "inline-block",
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.tertiary?.main ?? theme.palette.secondary.main} 100%)`,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
}));

export const Page = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  overflowWrap: "anywhere",
}));

export const Header = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  flexShrink: 0,
  [theme.breakpoints.down("md")]: {
    gap: theme.spacing(1),
    flexDirection: "column", alignItems: "stretch",
  },
}));
export const Actions = styled("div")(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  flexWrap: "wrap",
  "& button": { minHeight: 44 },
  "& .MuiIconButton-root": { width: 44, height: 44 },
  [theme.breakpoints.down("md")]: {
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "nowrap",
  },
  [theme.breakpoints.down("sm")]: {
    "& .MuiButton-root": { minWidth: 0, fontSize: "0.75rem" },
  },
}));
export const Workspace = styled("div")(({ theme }) => ({
  display: "flex",
  minWidth: 0,
  gap: theme.spacing(2),
  minHeight: 0,
  flex: 1,
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
  width: 244,
  boxSizing: "border-box",
  flexShrink: 0,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  padding: theme.spacing(1.5),
  background: theme.palette.background.paper,
  "&[data-collapsed=true]": { width: 64, padding: "8px 9px" },
}));
export const Chat = styled("div")(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  background: theme.palette.background.default,
  "&[data-empty=true] > [data-chat-messages]": { flex: "0 1 auto", marginTop: "auto" },
  "&[data-empty=true] > form": { marginBottom: "auto" },
}));
export const ChatNotices = styled("div")(({ theme }) => ({
  "&:empty": { display: "none" },
  position: "relative",
  padding: theme.spacing(0, 1, 1.5),
  display: "flex",
  flexDirection: "column",
  flexShrink: 1,
  minHeight: 0,
  maxHeight: "40%",
  width: "100%", maxWidth: "56rem", alignSelf: "center", boxSizing: "border-box",
  ...scrollAreaStyles(theme),
  gap: theme.spacing(1),
}));
export const Messages = styled(ScrollArea)(({ theme }) => ({
  flex: 1,
  width: "100%", maxWidth: "56rem", alignSelf: "center", boxSizing: "border-box",
  overflowAnchor: "none",
  minHeight: 0,
  padding: theme.spacing(2, 1, 3),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  "& > *": { flexShrink: 0, minWidth: 0 },
  "& [data-message-id] + [data-message-id]": { marginTop: theme.spacing(3) },
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1, 0, 2),
  },
}));

export const Welcome = styled("div")(({ theme }) => ({
  margin: "auto", width: "100%", maxWidth: "36rem", padding: theme.spacing(2, 0),
  textAlign: "center", minWidth: 0,
  "& h2": { fontWeight: 600, letterSpacing: "-0.025em", textWrap: "balance" },
  "& > svg": { fontSize: 32, color: theme.palette.primary.main, marginBottom: theme.spacing(1.5) },
  "& > button": { marginTop: theme.spacing(3), minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& > button": { width: "100%" } },
}));
