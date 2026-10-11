import { Box, Paper, TablePagination, TableContainer } from "@mui/material";
import type { PaperProps } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";

export const Wrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
}));
export const TableTopBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "stretch",
    "& button": { width: "100%", minHeight: 44 },
  },
}));
export const TableFrame = styled(Box)(({ theme }) => ({
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: theme.shadows[2],
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down("sm")]: {
    border: 0,
    boxShadow: "none",
    backgroundColor: "transparent",
  },
}));
export const EmptyBox = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center",
  padding: theme.spacing(2),
}));
export const RowActions = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  alignItems: "center",
}));
export const Actions = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    "& button": { width: "100%", minHeight: 44 },
  },
}));
export const ScrollTable = styled(TableContainer)(({ theme }) => {
  const thumb = alpha(
    theme.palette.mode === "dark" ? "#ffffff" : "#000000",
    0.2,
  );
  return {
    overflowX: "auto",
    scrollbarWidth: "thin",
    scrollbarColor: `${thumb} transparent`,
    "&::-webkit-scrollbar": { width: 6, height: 6 },
    "&::-webkit-scrollbar-track": { background: "transparent !important" },
    "&::-webkit-scrollbar-button": {
      display: "none !important",
      width: 0,
      height: 0,
    },
    "&::-webkit-scrollbar-thumb": {
      background: thumb,
      borderRadius: 9999,
      "&:hover": {
        background: alpha(
          theme.palette.mode === "dark" ? "#ffffff" : "#000000",
          0.35,
        ),
      },
    },
  };
});

export const Form = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
}));

export const KeyCards = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  minWidth: 0,
}));
export const KeyCard = styled(Paper)<PaperProps<"article">>(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.75),
  padding: theme.spacing(1.5),
  minWidth: 0,
  overflowWrap: "anywhere",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  boxShadow: "none",
}));
export const KeyHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(1),
  "& .MuiIconButton-root": { minWidth: 44, minHeight: 44 },
}));
export const KeySelection = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(1),
  minHeight: 44,
  marginTop: theme.spacing(0.75),
  paddingTop: theme.spacing(0.75),
  borderTop: `1px solid ${theme.palette.divider}`,
  "& .MuiSwitch-root": { minHeight: 44 },
}));
export const ListPagination = TablePagination;
