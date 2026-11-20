import { alpha, Box, Button, Stack, styled } from "@mui/material";

const wideEditor = "@container planStructure (min-width: 46rem)";

export const Editor = styled(Box)({
  containerName: "planStructure",
  containerType: "inline-size",
  minWidth: 0,
});

export const EditorLayout = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(2),
  alignItems: "start",
  [wideEditor]: {
    gridTemplateColumns: "minmax(13rem, 15rem) minmax(0, 1fr)",
    gap: theme.spacing(3),
  },
}));

export const Navigator = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(1.5),
  minWidth: 0,
  padding: theme.spacing(1.5),
  borderRadius: theme.spacing(1.75),
  border: "1px solid " + theme.palette.divider,
  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.045 : 0.03),
}));

export const DesktopNavigator = styled("nav")(({ theme }) => ({
  display: "none",
  minWidth: 0,
  gap: theme.spacing(1),
  [wideEditor]: { display: "grid" },
}));

export const CompactNavigator = styled(Box)({
  minWidth: 0,
  [wideEditor]: { display: "none" },
});

export const ViewButton = styled(Button)(({ theme }) => ({
  minHeight: 44,
  minWidth: 0,
  justifyContent: "flex-start",
  textAlign: "start",
  alignItems: "center",
  borderColor: "transparent",
  color: theme.palette.text.primary,
  padding: theme.spacing(1, 1.25),
  gap: theme.spacing(1),
  "&.MuiButton-root:hover": { borderColor: theme.palette.divider },
  '&[aria-current="true"], &[aria-current="true"]:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.42),
    backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.075),
  },
  "& .MuiSvgIcon-root": { flexShrink: 0, color: theme.palette.primary.main },
}));

export const SectionOrder = styled("span")(({ theme }) => ({
  display: "grid",
  placeItems: "center",
  flex: "0 0 1.75rem",
  height: "1.75rem",
  borderRadius: theme.spacing(0.75),
  fontSize: theme.typography.body2.fontSize,
  fontWeight: 700,
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.09),
}));

export const Workspace = styled("section")(({ theme }) => ({
  minWidth: 0,
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1.75),
  border: "1px solid " + theme.palette.divider,
  backgroundColor: theme.palette.background.paper,
  [wideEditor]: { padding: theme.spacing(3) },
}));

export const WorkspaceHeading = styled("h4")(({ theme }) => ({
  ...theme.typography.h6,
  margin: 0,
  fontWeight: 700,
  overflowWrap: "anywhere",
  scrollMarginBlockStart: theme.spacing(2),
  "&:focus-visible": { outline: "2px solid " + theme.palette.primary.main, outlineOffset: 4 },
}));

export const FieldGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 13rem), 1fr))",
  gap: theme.spacing(2),
  alignItems: "start",
  minWidth: 0,
}));

export const Details = styled("details")(({ theme }) => ({
  minWidth: 0,
  border: "1px solid " + theme.palette.divider,
  borderRadius: theme.spacing(1.25),
  "& > summary": {
    display: "flex",
    gap: theme.spacing(1),
    alignItems: "center",
    padding: theme.spacing(1, 1.5),
    minHeight: 48,
    boxSizing: "border-box",
    cursor: "pointer",
    listStyle: "none",
    borderRadius: "inherit",
    "&::-webkit-details-marker": { display: "none" },
    "&:hover": { backgroundColor: theme.palette.action.hover },
    '&[aria-disabled="true"]': { cursor: "default", backgroundColor: "transparent" },
    "&:focus-visible": { outline: "2px solid " + theme.palette.primary.main, outlineOffset: 2 },
    "& > .MuiSvgIcon-root:last-child": { marginInlineStart: "auto", flexShrink: 0 },
  },
  "&[open] > summary": { borderEndStartRadius: 0, borderEndEndRadius: 0 },
  "&[open] > summary > .MuiSvgIcon-root:last-child": { rotate: "180deg" },
}));

export const DetailFields = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(2),
  minWidth: 0,
  borderTop: "1px solid " + theme.palette.divider,
  padding: theme.spacing(2),
}));

export const Actions = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  "& > button": {
    minHeight: 44,
    maxWidth: "100%",
    [theme.breakpoints.down("sm")]: { width: "100%" },
  },
}));
