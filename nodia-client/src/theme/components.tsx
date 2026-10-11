import type { ThemeOptions } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";

type Components = ThemeOptions["components"];

const components: Components = {
  MuiCssBaseline: {
    styleOverrides: (theme) => {
      const isDark = theme.palette.mode === "dark";
      const thumbColor = isDark ? alpha("#ffffff", 0.2) : alpha("#000000", 0.2);
      const thumbHoverColor = isDark
        ? alpha("#ffffff", 0.35)
        : alpha("#000000", 0.35);

      return {
        "*": {
          scrollbarWidth: "thin",
          scrollbarColor: `${thumbColor} transparent`,
          "&::-webkit-scrollbar": {
            width: "6px",
            height: "6px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent !important",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: thumbColor,
            borderRadius: "9999px",
            border: "none",
            "&:hover": {
              backgroundColor: thumbHoverColor,
            },
          },
          "&::-webkit-scrollbar-button": {
            display: "none !important",
            width: 0,
            height: 0,
          },
          "&::-webkit-scrollbar-corner": {
            background: "transparent !important",
          },
        },
      };
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        boxShadow: "none",
        "&:hover": {
          boxShadow: "none",
        },
      },
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: ({ theme }) => ({
        backgroundColor: theme.palette.primary.main,
        "& .MuiTableCell-head": {
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          fontWeight: 700,
        },
      }),
    },
  },
  MuiTableCell: {
    styleOverrides: {
      head: ({ theme }) => ({
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        fontWeight: 700,
      }),
    },
  },
  MuiTable: {
    styleOverrides: {
      root: {
        minWidth: 650,
      },
    },
  },
  MuiTablePagination: {
    styleOverrides: {
      root: ({ theme }) => ({
        [theme.breakpoints.down("sm")]: { overflow: "visible" },
      }),
      toolbar: ({ theme, ownerState }) => ({
        [theme.breakpoints.down("sm")]: {
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          columnGap: theme.spacing(1),
          rowGap: 0,
          padding: theme.spacing(1.5, 2),
          // Force the row break while centering each pair independently.
          // The control order remains label, select, range, actions.
          "&::after": {
            content: '""',
            display:
              (ownerState.rowsPerPageOptions?.length ?? 2) > 1
                ? "block"
                : "none",
            order: 1,
            flex: "0 0 100%",
            height: theme.spacing(0.5),
          },
        },
      }),
      spacer: ({ theme }) => ({
        [theme.breakpoints.down("sm")]: { display: "none" },
      }),
      selectLabel: ({ theme }) => ({
        [theme.breakpoints.down("sm")]: {
          order: 0,
          margin: 0,
        },
      }),
      selectRoot: ({ theme }) => ({
        [theme.breakpoints.down("sm")]: {
          order: 0,
          margin: 0,
          minHeight: 44,
        },
      }),
      displayedRows: ({ theme }) => ({
        [theme.breakpoints.down("sm")]: {
          order: 2,
          margin: 0,
          minWidth: 0,
          overflowWrap: "anywhere",
        },
      }),
      actions: ({ theme }) => ({
        [theme.breakpoints.down("sm")]: {
          order: 2,
          marginLeft: 0,
          "& button": { width: 44, height: 44 },
        },
      }),
    },
  },
  MuiTableContainer: {
    styleOverrides: {
      root: {
        maxWidth: "100%",
        overflowX: "auto",
      },
    },
  },
  MuiTableSortLabel: {
    styleOverrides: {
      root: {
        color: "inherit",
        "&:hover": {
          color: "inherit",
        },
        "&.Mui-active": {
          color: "inherit",
          "& .MuiTableSortLabel-icon": {
            color: "inherit !important",
          },
        },
      },
      icon: {
        color: "inherit !important",
      },
    },
  },
};

export default components;
