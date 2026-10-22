import { styled, alpha } from "@mui/material/styles";
import { Button } from "@mui/material";

export const TextControls = styled("div")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr)", alignItems: "center", gap: theme.spacing(1.5),
  [theme.breakpoints.up("sm")]: { gridTemplateColumns: "minmax(0, 1fr) auto" },
  "& .MuiInputBase-root": { minHeight: 44 },
}));

export const TextLabel = styled("label")(({ theme }) => ({
  ...theme.typography.body2, fontWeight: 600, color: theme.palette.text.primary,
}));

export const TextHelp = styled("p")(({ theme }) => ({
  ...theme.typography.caption, color: theme.palette.text.secondary, margin: 0,
}));

export const SendTextButton = styled(Button)(({ theme }) => ({
  minWidth: 140, minHeight: 44,
  [theme.breakpoints.down("sm")]: { width: "100%" },
}));

export const ScreenViewport = styled("div")(({ theme }) => {
  const thumb = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2);
  return { overflow: "auto", maxHeight: "55vh", scrollbarWidth: "thin", scrollbarColor: `${thumb} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-thumb": { background: thumb, borderRadius: 9999, border: "none" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
  };
});

export const ScreenButton = styled("button")(({ theme }) => ({
  display: "block", width: "100%", padding: 0, border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius, background: theme.palette.background.default,
  cursor: "crosshair", overflow: "hidden", lineHeight: 0,
  "&:focus-visible": { outline: `3px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
  "&:disabled": { cursor: "wait" },
  "& img": { display: "block", width: "100%", height: "auto" },
}));
