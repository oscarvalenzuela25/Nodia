import { Avatar as MuiAvatar, Box, Stack } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const ConversationHeader = styled(Box)(({ theme }) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
  gap: theme.spacing(2), padding: theme.spacing(3, 3, 2),
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(2), "& > span": { width: "100%" }, "& button": { width: "100%" } },
}));

export const History = styled(Stack)(({ theme }) => ({
  minWidth: 0, minHeight: 144, maxHeight: "min(52dvh, 34rem)", overflowY: "auto",
  padding: theme.spacing(1, 3, 2),
  "& article + article": { marginTop: theme.spacing(2) },
  scrollbarWidth: "thin", scrollbarColor: `${alpha(theme.palette.text.primary, .2)} transparent`,
  "&::-webkit-scrollbar": { width: 6, height: 6 },
  "&::-webkit-scrollbar-track": { background: "transparent !important" },
  "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
  "&::-webkit-scrollbar-thumb": { background: alpha(theme.palette.text.primary, .2), borderRadius: 9999, border: 0,
    "&:hover": { background: alpha(theme.palette.text.primary, .35) } },
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(0, 2, 2) },
}));

export const MessageRow = styled("article", { shouldForwardProp: prop => prop !== "isOwner" })<{ isOwner: boolean }>(({ theme, isOwner }) => ({
  display: "flex", flexDirection: isOwner ? "row-reverse" : "row", alignItems: "flex-start",
  alignSelf: isOwner ? "flex-end" : "flex-start", width: "fit-content", minWidth: 0, flexShrink: 0,
  marginLeft: isOwner ? "auto" : 0, marginRight: isOwner ? 0 : "auto",
  maxWidth: isOwner ? "min(88%, 44rem)" : "min(100%, 56rem)", gap: theme.spacing(1.25),
  [theme.breakpoints.down("sm")]: { maxWidth: isOwner ? "94%" : "100%", gap: theme.spacing(.75) },
}));

export const MessageAvatar = styled(MuiAvatar, { shouldForwardProp: prop => prop !== "isOwner" })<{ isOwner: boolean }>(({ theme, isOwner }) => ({
  width: 32, height: 32, marginTop: theme.spacing(.5), flexShrink: 0, borderRadius: isOwner ? "50%" : 11,
  background: alpha(isOwner ? theme.palette.text.primary : theme.palette.primary.main, isOwner ? .05 : .15),
  color: isOwner ? theme.palette.text.primary : theme.palette.primary.main,
  [theme.breakpoints.down("sm")]: { width: 26, height: 30 },
}));

export const Bubble = styled(Box, { shouldForwardProp: prop => prop !== "isOwner" })<{ isOwner: boolean }>(({ theme, isOwner }) => ({
  minWidth: 0, padding: theme.spacing(1.5, 2), borderRadius: isOwner ? "20px 6px 20px 20px" : "6px 20px 20px 20px",
  background: isOwner ? (theme.palette.mode === "dark" ? theme.palette.primary.dark : theme.palette.primary.main) : theme.palette.background.paper,
  color: isOwner ? theme.palette.getContrastText(theme.palette.mode === "dark" ? theme.palette.primary.dark : theme.palette.primary.main) : theme.palette.text.primary,
  border: `1px solid ${isOwner ? "transparent" : alpha(theme.palette.text.primary, .07)}`,
  boxShadow: `0 4px 16px ${alpha(isOwner ? theme.palette.primary.main : "#000", isOwner ? .14 : .035)}`,
  "& p": { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: ".9375rem", lineHeight: 1.7, margin: 0 },
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(1.25, 1.5) },
}));
