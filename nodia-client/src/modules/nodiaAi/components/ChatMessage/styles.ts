import { alpha, styled } from "@mui/material/styles";
import MuiAvatar from "@mui/material/Avatar";

const ownerProp = (prop: PropertyKey) => prop !== "isOwner";

export const MessageRow = styled("article", { shouldForwardProp: ownerProp })<{ isOwner: boolean }>(({ theme, isOwner }) => ({
  display: "flex",
  flexDirection: isOwner ? "row-reverse" : "row",
  alignItems: "flex-start",
  alignSelf: isOwner ? "flex-end" : "flex-start",
  // Skeleton adds a neutral block wrapper; margins preserve chat alignment there too.
  marginLeft: isOwner ? "auto" : 0,
  marginRight: isOwner ? 0 : "auto",
  marginBottom: theme.spacing(3),
  gap: theme.spacing(1.25),
  width: "fit-content",
  minWidth: 0,
  maxWidth: isOwner ? "min(88%, 44rem)" : "min(100%, 56rem)",
  [theme.breakpoints.down("sm")]: {
    gap: theme.spacing(0.75),
    maxWidth: isOwner ? "94%" : "100%",
  },
}));

export const Avatar = styled(MuiAvatar, { shouldForwardProp: ownerProp })<{ isOwner: boolean }>(({ theme, isOwner }) => ({
  display: "grid",
  placeItems: "center",
  width: 32,
  height: 32,
  flexShrink: 0,
  marginTop: theme.spacing(0.5),
  borderRadius: isOwner ? "50%" : 11,
  background: isOwner
    ? alpha(theme.palette.text.primary, 0.05)
    : alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.15 : 0.08),
  color: isOwner ? theme.palette.text.secondary : theme.palette.primary.main,
  fontFamily: isOwner ? "inherit" : '"Karmatic Arcade", monospace, sans-serif',
  fontSize: "1.125rem",
  lineHeight: 1,
  [theme.breakpoints.down("sm")]: { width: 26, height: 30, fontSize: "1rem" },
}));

export const Content = styled("div")({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 0,
  flex: "1 1 auto",
});

export const Bubble = styled("div", { shouldForwardProp: ownerProp })<{ isOwner: boolean }>(({ theme, isOwner }) => {
  const ownerBackground = theme.palette.mode === "dark" ? theme.palette.primary.dark : theme.palette.primary.main;
  return {
    minWidth: 0,
    padding: theme.spacing(1.5, 2),
    borderRadius: isOwner ? "20px 6px 20px 20px" : "6px 20px 20px 20px",
    border: `1px solid ${isOwner ? alpha(ownerBackground, 0.3) : alpha(theme.palette.text.primary, 0.07)}`,
    background: isOwner ? ownerBackground : theme.palette.background.paper,
    color: isOwner ? theme.palette.getContrastText(ownerBackground) : theme.palette.text.primary,
    boxShadow: isOwner
      ? `0 4px 16px ${alpha(theme.palette.primary.main, 0.14)}`
      : `0 3px 14px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.1 : 0.035)}`,
    [theme.breakpoints.down("sm")]: { padding: theme.spacing(1.25, 1.5) },
  };
});

export const Identity = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "baseline",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  marginBottom: theme.spacing(0.75),
  fontSize: "0.6875rem",
  lineHeight: 1.4,
  "& time": { marginLeft: "auto", opacity: 0.7, fontVariantNumeric: "tabular-nums" },
}));

export const MessageText = styled("div")(({ theme }) => ({
  ...theme.typography.body2,
  fontSize: "0.9375rem",
  lineHeight: 1.7,
  color: "inherit",
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  minWidth: 0,
}));
