import { styled, alpha } from "@mui/material/styles";
import {
  Box,
  Paper,
  Typography,
  Button,
  FormControlLabel,
  Switch,
  TableContainer,
  TableHead,
  TableCell,
  TableRow,
} from "@mui/material";

export const DetailContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3), // 24px standard panel gap
  width: "100%",
}));

export const TopNavigationBox = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 2.5),
  backgroundColor: alpha(theme.palette.background.paper, 0.6),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  backdropFilter: "blur(8px)",
}));

export const BreadcrumbBox = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  flexWrap: "wrap",
}));

export const BackLinkButton = styled(Button)(({ theme }) => ({
  textTransform: "none",
  fontWeight: 600,
  fontSize: "0.875rem",
  color: theme.palette.text.secondary,
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius,
  "&:hover": {
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
}));

export const BreadcrumbDivider = styled("span")(({ theme }) => ({
  color: theme.palette.divider,
  fontSize: "1rem",
  userSelect: "none",
}));

export const StatusPill = styled(Box, {
  shouldForwardProp: (prop) => prop !== "statusType",
})<{ statusType: string }>(({ theme, statusType }) => {
  let bg = alpha(theme.palette.success.main, 0.12);
  let color = theme.palette.success.main;
  let borderColor = alpha(theme.palette.success.main, 0.3);

  if (statusType === "expired" || statusType === "warning") {
    bg = alpha(theme.palette.warning.main, 0.12);
    color = theme.palette.warning.main;
    borderColor = alpha(theme.palette.warning.main, 0.3);
  } else if (statusType === "degraded" || statusType === "error") {
    bg = alpha(theme.palette.error.main, 0.12);
    color = theme.palette.error.main;
    borderColor = alpha(theme.palette.error.main, 0.3);
  } else if (statusType === "unconfigured") {
    bg = alpha(theme.palette.text.secondary, 0.12);
    color = theme.palette.text.secondary;
    borderColor = alpha(theme.palette.text.secondary, 0.3);
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.5, 1.5),
    borderRadius: 9999,
    fontSize: "0.75rem",
    fontWeight: 700,
    backgroundColor: bg,
    color,
    border: `1px solid ${borderColor}`,
    letterSpacing: "0.02em",
  };
});

export const StatusDot = styled("span")<{ color?: string }>(({ theme, color }) => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  backgroundColor: color || theme.palette.success.main,
  display: "inline-block",
}));

export const DetailPanel = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4), // 32px standard panel padding
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  position: "relative",
}));

export const PanelHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
}));

export const PanelTitle = styled(Typography)(({ theme }) => ({
  fontSize: "1.25rem",
  fontWeight: 700,
  color: theme.palette.text.primary,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
}));

export const PanelSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  color: theme.palette.text.secondary,
  lineHeight: 1.5,
}));

export const ModelsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: theme.spacing(2),
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",
  },
}));

export const ModelCardPaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== "selected",
})<{ selected?: boolean }>(({ theme, selected }) => ({
  padding: theme.spacing(2.5),
  borderRadius: Number(theme.shape.borderRadius) * 1.25,
  border: `2px solid ${
    selected ? theme.palette.primary.main : theme.palette.divider
  }`,
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.04)
    : alpha(theme.palette.background.default, 0.4),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  transition: theme.transitions.create(["border-color", "background-color", "box-shadow"], {
    duration: theme.transitions.duration.shorter,
  }),
  "&:hover": {
    borderColor: selected
      ? theme.palette.primary.main
      : alpha(theme.palette.primary.main, 0.4),
    boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.08)}`,
  },
}));

export const ModelCardHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing(1.5),
}));

export const ModelBadge = styled(Box)(({ theme }) => ({
  width: 38,
  height: 38,
  borderRadius: theme.shape.borderRadius,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: "0.875rem",
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
  color: theme.palette.primary.main,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
  flexShrink: 0,
}));

export const ModelMetricsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: theme.spacing(1.5),
  paddingTop: theme.spacing(1.5),
  borderTop: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

export const MetricColumn = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.25),
}));

export const MetricTitle = styled(Typography)(({ theme }) => ({
  fontSize: "0.75rem",
  color: theme.palette.text.secondary,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontWeight: 600,
}));

export const MetricVal = styled(Typography)(({ theme }) => ({
  fontSize: "0.875rem",
  fontWeight: 700,
  color: theme.palette.text.primary,
}));

export const ParametersSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.background.default, 0.5),
  border: `1px solid ${theme.palette.divider}`,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
}));

export const ParametersGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: theme.spacing(3),
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",
  },
}));

export const PipelineStatusBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  paddingTop: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

export const ModeSectionGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: theme.spacing(2),
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

export const ModeCardPaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== "selected" && prop !== "disabled",
})<{ selected?: boolean; disabled?: boolean }>(({ theme, selected, disabled }) => ({
  padding: theme.spacing(2.5),
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  border: `2px solid ${
    selected ? theme.palette.primary.main : theme.palette.divider
  }`,
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.05)
    : theme.palette.background.paper,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.25),
  transition: theme.transitions.create(["border-color", "background-color"], {
    duration: theme.transitions.duration.shorter,
  }),
  "&:hover": {
    borderColor: disabled ? theme.palette.divider : theme.palette.primary.main,
  },
}));

export const WebSessionBanner = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.75, 2.5),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
  backgroundColor: alpha(theme.palette.warning.main, 0.08),
}));

export const CloudBridgeBox = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(3),
  padding: theme.spacing(3),
  borderRadius: Number(theme.shape.borderRadius) * 1.25,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  backgroundColor: alpha(theme.palette.primary.main, 0.04),
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
}));

export const AuthStepsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.background.default, 0.4),
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "repeat(2, 1fr)",
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

export const AuthStepCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active" && prop !== "completed",
})<{ active?: boolean; completed?: boolean }>(({ theme, active, completed }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.5),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: active
    ? alpha(theme.palette.primary.main, 0.08)
    : completed
    ? alpha(theme.palette.success.main, 0.04)
    : "transparent",
  border: active
    ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}`
    : completed
    ? `1px solid ${alpha(theme.palette.success.main, 0.2)}`
    : `1px solid transparent`,
}));

export const RemoteParamsGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: theme.spacing(2),
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr",
  },
}));

export const SwitchWrapper = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.background.default, 0.5),
}));

export const StyledFormControlLabel = styled(FormControlLabel)(({ theme }) => ({
  margin: 0,
  width: "100%",
  justifyContent: "space-between",
  "& .MuiFormControlLabel-label": {
    fontWeight: 600,
    fontSize: "0.875rem",
    color: theme.palette.text.primary,
  },
}));

export const StyledSwitch = styled(Switch)(({ theme }) => ({
  "& .MuiSwitch-switchBase.Mui-checked": {
    color: theme.palette.success.main,
    "&:hover": {
      backgroundColor: alpha(theme.palette.success.main, 0.08),
    },
  },
  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
    backgroundColor: theme.palette.success.main,
  },
}));

export const TableScrollContainer = styled(Box)(({ theme }) => ({
  overflowX: "auto",
  width: "100%",
  scrollbarWidth: "thin",
  scrollbarColor: `${alpha(theme.palette.text.primary, 0.2)} transparent`,
  "&::-webkit-scrollbar": {
    height: 6,
    width: 6,
  },
  "&::-webkit-scrollbar-track": {
    background: "transparent !important",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: alpha(theme.palette.text.primary, 0.2),
    borderRadius: 9999,
    "&:hover": {
      backgroundColor: alpha(theme.palette.text.primary, 0.35),
    },
  },
  "&::-webkit-scrollbar-button": {
    display: "none !important",
    width: 0,
    height: 0,
  },
}));

export const TableTopBar = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(2),
  width: "100%",
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

export const EmptyBox = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(1.5),
  padding: theme.spacing(6, 2),
  color: theme.palette.text.secondary,
  textAlign: "center",
}));

