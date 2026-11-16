export { ComposerShell, InputRow, MessageInput, Toolbar } from "../../../../components/MessageComposer/styles";

import { alpha, styled, type SxProps, type Theme } from "@mui/material/styles";

export const composerStyles: SxProps<Theme> = theme => ({
  width: "100%", maxWidth: "56rem", boxSizing: "border-box", alignSelf: "center",
  margin: 0, maxHeight: "100%", borderRadius: "16px", containerType: "inline-size",
  "& > [data-composer-toolbar]": {
    minHeight: 44, flex: "0 1 auto", overflowY: "auto",
    scrollbarWidth: "thin", scrollbarColor: `${alpha(theme.palette.text.primary, 0.2)} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
    "&::-webkit-scrollbar-thumb": { background: alpha(theme.palette.text.primary, 0.2), borderRadius: 9999, border: 0,
      "&:hover": { background: alpha(theme.palette.text.primary, 0.35) } },
    // A blocking notice gets the full width; it must not squeeze into the model button.
    "&:has([data-composer-footer] .MuiAlert-root), &:has([data-composer-footer] [role=status])": {
      display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) auto",
      "& > [data-composer-start]": { gridColumn: 1, gridRow: 1 },
      "& > [data-composer-controls]": { gridColumn: 3, gridRow: 1 },
      "& > [data-composer-footer]": { gridColumn: "1 / -1", gridRow: 2 },
    },
    "@container (max-width: 20rem)": {
      display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) auto",
      "& > [data-composer-start]": { gridColumn: 1, gridRow: 1 },
      "& > [data-composer-controls]": { gridColumn: 3, gridRow: 1 },
      "& > [data-composer-footer]": { gridColumn: "1 / -1", gridRow: 2 },
    },
  },
  [theme.breakpoints.down("sm")]: { margin: 0, borderRadius: "16px" },
});

export const ReviewArea = styled("div")(({ theme }) => ({
  minWidth: 0, minHeight: 0, flex: "0 1 auto", maxHeight: "min(25dvh, 14rem)", overflowY: "auto", padding: theme.spacing(0.5),
  scrollbarWidth: "thin", scrollbarColor: `${alpha(theme.palette.text.primary, 0.2)} transparent`,
  "&::-webkit-scrollbar": { width: 6, height: 6 },
  "&::-webkit-scrollbar-track": { background: "transparent !important" },
  "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
  "&::-webkit-scrollbar-thumb": { background: alpha(theme.palette.text.primary, 0.2), borderRadius: 9999, border: 0, "&:hover": { background: alpha(theme.palette.text.primary, 0.35) } },
}));
