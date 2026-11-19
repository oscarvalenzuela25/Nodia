import { alpha, styled } from "@mui/material/styles";
import MuiAvatar from "@mui/material/Avatar";

const ownerProp = (prop: PropertyKey) => prop !== "isOwner";

export const MessageRow = styled("article", { shouldForwardProp: ownerProp })<{ isOwner: boolean }>(({ theme, isOwner }) => ({
  display: "flex",
  flexDirection: "column",
  alignSelf: isOwner ? "flex-end" : "flex-start",
  // Skeleton adds a neutral block wrapper; margins preserve chat alignment there too.
  marginLeft: isOwner ? "auto" : 0,
  marginRight: isOwner ? 0 : "auto",
  width: isOwner ? "fit-content" : "100%",
  minWidth: 0,
  maxWidth: isOwner ? "min(88%, 44rem)" : "100%",
  [theme.breakpoints.down("sm")]: {
    maxWidth: isOwner ? "94%" : "100%",
  },
}));

export const Avatar = styled(MuiAvatar, { shouldForwardProp: ownerProp })<{ isOwner: boolean }>(({ theme, isOwner }) => ({
  display: "grid",
  placeItems: "center",
  width: 24,
  height: 24,
  flexShrink: 0,
  borderRadius: isOwner ? "50%" : theme.shape.borderRadius,
  background: isOwner
    ? alpha(theme.palette.text.primary, 0.05)
    : alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.15 : 0.08),
  color: isOwner ? theme.palette.text.secondary : theme.palette.primary.main,
  fontFamily: isOwner ? "inherit" : '"Karmatic Arcade", monospace, sans-serif',
  fontSize: isOwner ? "0.75rem" : "0.875rem",
  lineHeight: 1,
}));

export const Content = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  minWidth: 0,
  width: "100%",
}));

export const Bubble = styled("div", {
  shouldForwardProp: prop => ownerProp(prop) && prop !== "isAssistant",
})<{ isOwner: boolean; isAssistant?: boolean }>(({ theme, isOwner, isAssistant }) => ({
  minWidth: 0,
  padding: isOwner || isAssistant ? theme.spacing(1.5, 2) : 0,
  borderRadius: isOwner ? "16px 6px 16px 16px" : isAssistant ? "6px 16px 16px 16px" : 0,
  border: isOwner || isAssistant ? `1px solid ${theme.palette.divider}` : 0,
  backgroundColor: isOwner
    ? alpha(theme.palette.primary.main, 0.09)
    : isAssistant ? theme.palette.background.paper : "transparent",
  color: theme.palette.text.primary,
  [theme.breakpoints.down("sm")]: { padding: isOwner || isAssistant ? theme.spacing(1.25, 1.5) : 0 },
}));

export const Identity = styled("div", { shouldForwardProp: ownerProp })<{ isOwner: boolean }>(({ theme, isOwner }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: isOwner ? "flex-end" : "flex-start",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
  fontSize: "0.6875rem",
  lineHeight: 1.4,
  "& time": { fontVariantNumeric: "tabular-nums" },
}));

export const MessageBody = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1.75), minWidth: 0,
}));

export const MessageActions = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", minWidth: 0,
  marginTop: theme.spacing(1),
  "& button": {
    width: 44, height: 44, color: theme.palette.text.secondary,
    "&:hover": { color: theme.palette.text.primary, background: alpha(theme.palette.text.primary, 0.05) },
    "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  },
}));

export const MessageText = styled("div")(({ theme }) => ({
  ...theme.typography.body2,
  fontSize: "1rem",
  lineHeight: 1.7,
  color: "inherit",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  minWidth: 0,
}));
