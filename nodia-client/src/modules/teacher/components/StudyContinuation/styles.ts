import { Box, Stack, styled } from "@mui/material";
import { alpha } from "@mui/material/styles";

export const ContinuationPanel = styled("section")(({ theme }) => ({
  minWidth: 0, display: "flex", flexDirection: "column", gap: theme.spacing(2),
  padding: theme.spacing(3), borderRadius: theme.spacing(2), backgroundImage: "none",
  border: `1px solid ${theme.palette.divider}`, borderTop: `3px solid ${theme.palette.primary.main}`,
  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .08 : .025),
  overflowWrap: "anywhere",
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
}));
export const Context = styled(Stack)(({ theme }) => ({ minWidth: 0, gap: theme.spacing(.75) }));
export const Actions = styled(Box)(({ theme }) => ({
  minWidth: 0, display: "flex",
  "& > button": { minHeight: 44, whiteSpace: "normal", [theme.breakpoints.down("sm")]: { width: "100%" } },
}));
