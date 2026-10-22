import { alpha, styled, type CSSObject, type Theme } from "@mui/material/styles";

export const Page = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
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
    flexDirection: "column",
    alignItems: "stretch",
    "& button": { width: "100%" },
  },
}));
export const Workspace = styled("div")(({ theme }) => ({
  display: "flex",
  minWidth: 0,
  gap: theme.spacing(2),
  height: "calc(100dvh - 15rem)",
  minHeight: 600,
  maxHeight: 1000,
  [theme.breakpoints.down("sm")]: { height: "auto", minHeight: 0, maxHeight: "none" },
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
  width: 264,
  flexShrink: 0,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
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
  borderRadius: theme.shape.borderRadius,
  background: theme.palette.background.paper,
}));
export const ChatHeading = styled("div")(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  gap: theme.spacing(1),
}));
export const Messages = styled(ScrollArea)(({ theme }) => ({
  flex: 1,
  overflowAnchor: "none",
  minHeight: 240,
  padding: theme.spacing(2),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  [theme.breakpoints.down("sm")]: {
    flex: "none",
    minHeight: 0,
    height: "clamp(15rem, 40dvh, 24rem)",
  },
}));
export const Message = styled("article", {
  shouldForwardProp: (prop) => prop !== "isOwner",
})<{ isOwner: boolean }>(({ theme, isOwner }) => ({
  alignSelf: isOwner ? "flex-end" : "stretch",
  maxWidth: isOwner ? "92%" : "100%",
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  background: isOwner ? alpha(theme.palette.primary.main, 0.08) : "transparent",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  minWidth: 0,
}));
export const Composer = styled("form")(({ theme }) => ({
  ...scrollAreaStyles(theme),
  padding: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
  flex: "0 1 auto",
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  [theme.breakpoints.up("sm")]: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "end",
    "& > .MuiAlert-root, & > .MuiTypography-root": { gridColumn: "1 / -1" },
    "& > [data-composer-actions]": { gridColumn: "1 / -1", justifyContent: "flex-end" },
  },
}));
