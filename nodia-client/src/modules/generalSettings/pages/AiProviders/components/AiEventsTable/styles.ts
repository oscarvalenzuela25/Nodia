import { styled, alpha } from "@mui/material/styles";
import {
  Box,
  Paper,
  TableContainer,
  TableHead,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";

export const TablePanel = styled(Paper)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  padding: theme.spacing(4), // 32px standard panel padding!
  borderRadius: Number(theme.shape.borderRadius) * 2,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.palette.mode === "dark"
    ? "0 4px 20px 0 rgba(0, 0, 0, 0.4)"
    : "0 4px 20px 0 rgba(0, 0, 0, 0.05)",
}));

export const TablePanelHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: theme.spacing(2),
  width: "100%",
}));

export const HeaderTitleBox = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(1.5),
}));

export const HeaderIconBox = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
}));

export const TableTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: "1.125rem",
  color: theme.palette.text.primary,
}));

export const TableSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: "0.8125rem",
  color: theme.palette.text.secondary,
  marginTop: 2,
}));

export const StyledTableContainer = styled(TableContainer)(({ theme }) => {
  const thumbColor =
    theme.palette.mode === "dark"
      ? alpha("#ffffff", 0.2)
      : alpha("#000000", 0.2);
  const thumbHoverColor =
    theme.palette.mode === "dark"
      ? alpha("#ffffff", 0.35)
      : alpha("#000000", 0.35);

  return {
    borderRadius: Number(theme.shape.borderRadius) * 1.5,
    border: `1px solid ${theme.palette.divider}`,
    scrollbarWidth: "thin",
    scrollbarColor: `${thumbColor} transparent`,
    "&::-webkit-scrollbar": {
      width: 6,
      height: 6,
    },
    "&::-webkit-scrollbar-track": {
      background: "transparent !important",
    },
    "&::-webkit-scrollbar-button": {
      display: "none !important",
      width: 0,
      height: 0,
    },
    "&::-webkit-scrollbar-thumb": {
      borderRadius: 9999,
      backgroundColor: thumbColor,
      "&:hover": {
        backgroundColor: thumbHoverColor,
      },
    },
  };
});

export const StyledTableHead = styled(TableHead)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
}));

export const HeadCell = styled(TableCell)(({ theme }) => ({
  fontSize: "0.6875rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  borderBottom: `1px solid ${alpha(theme.palette.primary.contrastText, 0.2)}`,
  padding: theme.spacing(1.5, 2),
  whiteSpace: "nowrap",
}));

export const BodyRow = styled(TableRow)(({ theme }) => ({
  transition: theme.transitions.create(["background-color"], {
    duration: theme.transitions.duration.shorter,
  }),
  "&:hover": {
    backgroundColor: alpha(theme.palette.action.hover, 0.04),
  },
  "&:last-child td, &:last-child th": {
    border: 0,
  },
}));

export const BodyCell = styled(TableCell)(({ theme }) => ({
  fontSize: "0.8125rem",
  color: theme.palette.text.primary,
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
  padding: theme.spacing(1.75, 2),
}));

export const ProviderBadge = styled(Box)(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing(0.75),
  padding: theme.spacing(0.4, 1.2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.background.default, 0.7),
  border: `1px solid ${theme.palette.divider}`,
  fontSize: "0.75rem",
  fontWeight: 600,
  color: theme.palette.text.primary,
}));

export const ImpactBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== "severity",
})<{ severity: "warning" | "success" | "info" | "default" }>(({ theme, severity }) => {
  let mainColor = theme.palette.text.secondary;
  if (severity === "warning") mainColor = "#f59e0b";
  else if (severity === "success") mainColor = "#10b981";
  else if (severity === "info") mainColor = "#6366f1";

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.3, 1),
    borderRadius: 9999,
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor: alpha(mainColor, 0.12),
    color: mainColor,
    border: `1px solid ${alpha(mainColor, 0.3)}`,
    whiteSpace: "nowrap",
  };
});

export const EmptyBox = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(6, 2),
  textAlign: "center",
  gap: theme.spacing(1.5),
}));
