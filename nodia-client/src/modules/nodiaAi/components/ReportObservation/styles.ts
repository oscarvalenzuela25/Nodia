import { Box, TableContainer } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const ReportWrapper = styled(Box)(({ theme }) => ({
  minWidth: 0, width: "100%", maxWidth: "100%", display: "flex", flexDirection: "column", gap: theme.spacing(2), overflowWrap: "anywhere",
  "& > div, & [data-boneyard-content]": { minWidth: 0, width: "100%", maxWidth: "100%" },
  "& button": { minHeight: 44, [theme.breakpoints.down("sm")]: { width: "100%" } },
}));
export const SourceBlock = styled("section")(({ theme }) => ({
  minWidth: 0, width: "100%", maxWidth: "100%", borderLeft: `3px solid ${theme.palette.divider}`, paddingLeft: theme.spacing(1.5),
  display: "flex", flexDirection: "column", gap: theme.spacing(1),
  "& > div": { minWidth: 0, maxWidth: "100%" },
}));
export const ReportTableContainer = styled(TableContainer)(({ theme }) => {
  const thumb = alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.2);
  return {
    minWidth: 0, maxWidth: "100%", overflowX: "auto", scrollbarWidth: "thin", scrollbarColor: `${thumb} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": { display: "none !important", width: 0, height: 0 },
    "&::-webkit-scrollbar-thumb": { background: thumb, borderRadius: 9999, border: "none", "&:hover": { background: alpha(theme.palette.mode === "dark" ? "#ffffff" : "#000000", 0.35) } },
  };
});
