import { alpha, styled } from "@mui/material/styles";

export const Tools = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  "& button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& button": { width: "100%" } },
}));

export const Actions = styled(Tools)(({ theme }) => ({
  justifyContent: "flex-end",
  borderTop: "1px solid " + theme.palette.divider,
  paddingTop: theme.spacing(2),
}));

export const ReviewContent = styled("section")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  minWidth: 0,
  border: "1px solid " + theme.palette.divider,
  borderRadius: theme.shape.borderRadius,
  overflowWrap: "anywhere",
  "& .MuiChip-root": { maxWidth: "100%", height: "auto", minHeight: 24 },
  "& .MuiChip-label": { whiteSpace: "normal" },
}));

export const CopyFallback = styled("pre")(({ theme }) => {
  const thumb = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2);
  return {
    margin: 0,
    padding: theme.spacing(1),
    maxHeight: "15rem",
    backgroundColor: theme.palette.action.hover,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    overflowY: "auto",
    overscrollBehaviorY: "contain",
    scrollbarWidth: "thin",
    scrollbarColor: thumb + " transparent",
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
    "&::-webkit-scrollbar-thumb": { background: thumb, borderRadius: 9999, border: 0,
      "&:hover": { background: alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.35) } },
  };
});

export const ActivityList = styled("ol")(({ theme }) => ({
  margin: 0,
  paddingInlineStart: theme.spacing(2.5),
  overflowWrap: "anywhere",
  "& li + li": { marginTop: theme.spacing(1) },
}));
