import { alpha, styled, type CSSObject, type Theme } from "@mui/material/styles";

export const Page = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  overflowWrap: "anywhere",
  [theme.breakpoints.down("md")]: { minHeight: "min-content" },
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
  [theme.breakpoints.down("md")]: { minHeight: "min-content" },
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
export const DrawerHistory = styled(ScrollArea)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(1, 2, 2),
}));
export const History = styled(ScrollArea)(({ theme }) => ({
  width: 244,
  boxSizing: "border-box",
  flexShrink: 0,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 16,
  padding: theme.spacing(1.5),
  backgroundColor: theme.palette.background.paper,
  backgroundImage: `linear-gradient(${alpha(theme.palette.primary.main, 0.055)}, transparent 112px)`,
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
  [theme.breakpoints.down("md")]: {
    minHeight: "4.5rem",
    // The conversation can scroll as a whole on short screens. Loaded history
    // still belongs to this scroll region and must not size that outer scroll.
    "&:has([data-message-id])": { contain: "size" },
  },
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(1, 0, 2) },
}));

export const Welcome = styled("div")(({ theme }) => ({
  margin: "auto", width: "100%", maxWidth: "36rem", padding: theme.spacing(2, 0),
  textAlign: "center", minWidth: 0,
  "& h2": { fontWeight: 700, letterSpacing: "-0.025em", textWrap: "balance" },
  "& > p": { maxWidth: "38ch", marginInline: "auto" },
  "& > svg": {
    boxSizing: "border-box",
    width: 44,
    height: 44,
    padding: theme.spacing(1),
    borderRadius: 12,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
    backgroundColor: alpha(theme.palette.primary.main, 0.09),
    color: theme.palette.primary.main,
    marginBottom: theme.spacing(1.5),
  },
  "& > button": { marginTop: theme.spacing(3), minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& > button": { width: "100%" } },
}));
