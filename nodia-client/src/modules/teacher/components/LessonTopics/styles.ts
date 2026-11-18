import { Box, Stack } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { AdaptiveDrawer } from "../AdaptiveWorkspace/styles";

export const Topic = styled("section")(({ theme }) => ({
  minWidth: 0, border: `1px solid ${theme.palette.divider}`, borderRadius: theme.spacing(1.5),
  padding: theme.spacing(3), overflowWrap: "anywhere",
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
}));

export const TopicHeader = styled("div")(({ theme }) => ({
  display: "flex", justifyContent: "space-between", alignItems: "center",
  flexWrap: "wrap", gap: theme.spacing(1),
  "& > h3": { fontWeight: 700, minWidth: 0 },
  "& > .MuiButton-root": { maxWidth: "100%", textAlign: "start", whiteSpace: "normal" },
}));

export const TopicColumns = styled(Box)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0,1fr)", alignItems: "start", gap: theme.spacing(2),
  [theme.breakpoints.up("lg")]: {
    "&[data-clarification-open]": { gridTemplateColumns: "minmax(0,2fr) minmax(280px,1fr)" },
  },
}));

export const TopicText = styled("div")(({ theme }) => ({
  minWidth: 0,
  "& ::highlight(teacher-topic-fragment)": { backgroundColor: alpha(theme.palette.primary.main, .30), color: theme.palette.text.primary },
}));

export const TopicActions = styled(Stack)(({ theme }) => ({
  flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: theme.spacing(1),
  "& > .MuiButton-root": { [theme.breakpoints.down("sm")]: { width: "100%" } },
}));

export const ClarificationSurface = styled("aside")(({ theme }) => ({
  minWidth: 0, padding: theme.spacing(2), border: `1px solid ${alpha(theme.palette.primary.main, .45)}`,
  borderRadius: theme.spacing(1.5), backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .055 : .025),
  overflowWrap: "anywhere",
}));

export const ClarificationSheet = styled(AdaptiveDrawer)(({ theme }) => ({
  "& .MuiDrawer-paper": {
    insetInline: 0, width: "100%", maxHeight: "85dvh", borderTop: `1px solid ${theme.palette.divider}`,
    borderTopLeftRadius: theme.spacing(2), borderTopRightRadius: theme.spacing(2), borderLeft: 0,
  },
}));

export const FragmentQuote = styled("blockquote")(({ theme }) => ({
  margin: 0, padding: theme.spacing(.5, 1.5),
  borderInlineStart: `3px solid ${theme.palette.primary.main}`, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
}));
