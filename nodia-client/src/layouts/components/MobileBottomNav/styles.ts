import { Box, IconButton, Typography } from "@mui/material";
import { alpha, lighten, darken, styled } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import { Link } from "react-router";

export const MOBILE_NAV_RESERVED_HEIGHT = "calc(156px + env(safe-area-inset-bottom, 0px))";
export const NavRoot = styled(Box)(({ theme }) => ({
  position: "fixed", left: 0, right: 0, bottom: 0, zIndex: theme.zIndex.appBar, paddingTop: 60,
  pointerEvents: "none", "& a, & button": { pointerEvents: "auto" },
  [theme.breakpoints.up("sm")]: { display: "none" },
}));
export const Dock = styled("nav")(({ theme }) => ({
  pointerEvents: "auto", display: "grid", gridTemplateColumns: "1fr 1fr 80px 1fr 1fr", alignItems: "start",
  padding: `12px 4px calc(14px + env(safe-area-inset-bottom, 0px))`,
  background: theme.palette.background.paper, borderTop: `1px solid ${theme.palette.divider}`,
  borderRadius: `${theme.spacing(3)} ${theme.spacing(3)} 0 0`, boxShadow: `0 -5px 22px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? .35 : .08)}`,
  "@media (max-width: 359.95px)": { gridTemplateColumns: "1fr 1fr 68px 1fr 1fr" },
}));
export const Slot = styled(Box)({ display: "grid", justifyItems: "center", gap: 5, minWidth: 0 });
export const SlotLabel = styled(Typography)(({ theme }) => ({
  ...theme.typography.caption, fontSize: 11, maxWidth: "100%", paddingInline: 2,
  overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", color: theme.palette.text.secondary,
}));
const roundStyles = ({ theme }: { theme: Theme }) => ({
  width: 44, height: 44, borderRadius: "50%", border: `1px solid ${theme.palette.divider}`, color: theme.palette.text.secondary,
  background: theme.palette.background.default, "& svg": { fontSize: 22 },
  "&[data-configured=true]": { color: theme.palette.primary.main, background: alpha(theme.palette.primary.main, .12), borderColor: "transparent" },
  "&[data-empty=true]": { borderStyle: "dashed", background: theme.palette.background.paper },
  "&[aria-current=page]": { boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}` },
});
export const RoundButton = styled(IconButton)(roundStyles);
export const RoundLink = styled(Link)(roundStyles, ({ theme }) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", boxSizing: "border-box",
  "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 3 },
}));
export const HomeLink = styled(RoundLink)(({ theme }) => ({
  width: 72, height: 72, marginTop: -34, color: theme.palette.primary.contrastText,
  background: `linear-gradient(145deg, ${lighten(theme.palette.primary.main, .18)}, ${theme.palette.primary.main} 62%, ${darken(theme.palette.primary.main, .12)})`,
  borderColor: alpha(theme.palette.primary.main, .8),
  boxShadow: `0 0 0 6px ${theme.palette.background.default}, 0 9px 18px ${alpha(theme.palette.primary.main, .32)}, inset 0 2px 0 ${alpha(theme.palette.common.white, .2)}`,
  "& svg": { fontSize: 30 }, "&:hover": { backgroundColor: theme.palette.primary.dark },
  "&[aria-current=page]": { boxShadow: `0 0 0 6px ${theme.palette.background.default}, 0 9px 18px ${alpha(theme.palette.primary.main, .32)}, inset 0 2px 0 ${alpha(theme.palette.common.white, .2)}` },
  "@media (max-width: 359.95px)": { width: 64, height: 64, marginTop: -26 },
}));
export const LockButton = styled(RoundButton)(({ theme }) => ({
  position: "absolute", top: 8, right: 16, background: theme.palette.background.paper, color: theme.palette.primary.main,
  boxShadow: theme.shadows[2], "& svg": { fontSize: 20 },
  "&[aria-pressed=true]": { background: theme.palette.background.paper },
}));
export const EditBadge = styled("span")(({ theme }) => ({
  position: "absolute", right: -1, bottom: -1, width: 16, height: 16, display: "grid", placeItems: "center",
  borderRadius: "50%", background: theme.palette.primary.main, color: theme.palette.primary.contrastText,
  border: `1px solid ${theme.palette.background.paper}`, "& svg": { fontSize: 10 },
}));
