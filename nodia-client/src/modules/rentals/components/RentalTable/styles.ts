import { Box, Button, TableContainer, TablePagination } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const TableTopBar = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2.5),
  flexWrap: "wrap",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    alignItems: "stretch",
    "& > *, & button": { width: "100%" },
  },
}));

export const CreateButton = styled(Button)(({ theme }) => ({
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 2
      : theme.shape.borderRadius,
  color: theme.palette.primary.contrastText,
}));

export const TablePanel = styled(Box)(({ theme }) => ({
  position: "relative",
  border: `1px solid ${theme.palette.border?.default ?? theme.palette.divider}`,
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 2
      : theme.shape.borderRadius,
  overflow: "hidden",
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
}));

export const ResponsivePagination = styled(TablePagination)<{
  component: "div";
}>(({ theme }) => ({
  overflow: "hidden",
  "& .MuiTablePagination-toolbar": {
    justifyContent: "flex-end",
  },
  [theme.breakpoints.down("sm")]: {
    "& .MuiTablePagination-toolbar": {
      flexWrap: "wrap",
      gap: theme.spacing(1),
      padding: theme.spacing(1),
    },
    "& .MuiTablePagination-spacer": { display: "none" },
    "& .MuiTablePagination-actions": { marginLeft: 0 },
    "& .MuiTablePagination-select": { marginRight: 0 },
  },
}));

export const ScrollContainer = styled(TableContainer)(({ theme }) => {
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
      border: "none",
      "&:hover": {
        background: alpha(
          theme.palette.mode === "dark" ? "#ffffff" : "#000000",
          0.35,
        ),
      },
    },
  };
});
