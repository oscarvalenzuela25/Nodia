import { alpha, styled } from "@mui/material/styles";
import { Button, Popover } from "@mui/material";

export const SelectionPanel = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1), width: "100%", minWidth: 0,
  "& > .MuiAlert-root": { minWidth: 0 },
}));

export const SelectionSummary = styled(Button)(({ theme }) => ({
  width: "100%", minWidth: 0, height: 44, minHeight: 44, justifyContent: "space-between", textAlign: "left",
  padding: theme.spacing(0.25, 0.75), borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.primary, textTransform: "none",
  "& .MuiButton-endIcon": { flexShrink: 0 },
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));

export const SelectionPopover = styled(Popover)(({ theme }) => {
  const thumb = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2);
  return {
    "& .MuiPopover-paper": {
      width: "min(36rem, calc(100vw - 32px))", maxWidth: "calc(100vw - 32px)", maxHeight: "min(50dvh, 28rem)",
      minWidth: 0, boxSizing: "border-box", padding: theme.spacing(2), borderRadius: theme.spacing(2),
      border: `1px solid ${theme.palette.divider}`, overflowY: "auto", overflowX: "auto",
      scrollbarWidth: "thin", scrollbarColor: `${thumb} transparent`,
      "&::-webkit-scrollbar": { width: 6, height: 6 },
      "&::-webkit-scrollbar-track": { background: "transparent !important" },
      "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
      "&::-webkit-scrollbar-thumb": { background: thumb, borderRadius: 9999, border: 0,
        "&:hover": { background: alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.35) } },
    },
  };
});

export const SummaryContent = styled("span")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(0.25), minWidth: 0, flex: 1,
  "& > span:not([data-selection-description])": { minWidth: 0, maxWidth: "100%", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  "& [data-selection-description]": { position: "absolute", width: 1, height: 1, padding: 0,
    overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" },
}));

export const SelectionBar = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(0.75),
  minWidth: 0,
  flex: "1 1 32rem",
  "& > .MuiAlert-root": { flexBasis: "100%", minWidth: 0 },
}));

export const Selector = styled("div")(({ theme }) => ({
  flex: "1 1 8rem",
  maxWidth: "16rem",
  minWidth: 0,
  position: "relative",
  "& label": {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    border: 0,
  },
  "& [aria-haspopup='listbox']": {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    background: alpha(theme.palette.text.primary, 0.035),
    padding: theme.spacing(0.75, 1.25),
    "&:hover, &:focus-visible": {
      borderColor: alpha(theme.palette.primary.main, 0.35),
      background: alpha(theme.palette.primary.main, 0.06),
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
    "& .MuiTypography-root": { fontSize: "0.75rem", fontWeight: 500 },
  },
  [theme.breakpoints.down("sm")]: { flexBasis: "calc(50% - 8px)", maxWidth: "none" },
}));

export const DraftActions = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  flexBasis: "100%",
  "& button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: {
    "& button": { flex: 1 },
    "& .MuiTypography-root": { flexBasis: "100%" },
  },
}));
