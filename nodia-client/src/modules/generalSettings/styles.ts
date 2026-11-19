import { Box, Paper } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import { TABLE_PANEL_RADIUS } from "../../theme/tablePanel";

export const PageTitleContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  minWidth: 0,
  "& > svg": {
    fontSize: "1.5rem",
    width: 42,
    height: 42,
    padding: theme.spacing(1),
    flexShrink: 0,
    borderRadius: theme.spacing(1.5),
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.2)}`,
  },
}));

export const PageTitle = styled("h1")(({ theme }) => ({
  ...theme.typography.h4,
  fontSize: "1.5rem",
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: theme.palette.text.primary,
  margin: 0,
  minWidth: 0,
  overflowWrap: "anywhere",
  [theme.breakpoints.up("sm")]: { fontSize: "1.875rem" },
  [theme.breakpoints.up("md")]: { fontSize: "2.125rem" },
}));

export const PageSubtitle = styled("p")(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.palette.text.secondary,
  maxWidth: "65ch",
  margin: 0,
  lineHeight: 1.6,
  overflowWrap: "anywhere",
}));

export const StyledTableContainer = styled(Box)(({ theme }) => ({
  borderRadius: TABLE_PANEL_RADIUS,
  overflow: "hidden",
  boxShadow: theme.shadows[1],
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.border?.default ?? theme.palette.divider}`,
}));

export const SectionCard = styled(Paper)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  overflow: "hidden",
  boxShadow: theme.shadows[1],
  backgroundColor: theme.palette.background.paper,
  backgroundImage: "none",
  border: `1px solid ${theme.palette.border?.default ?? theme.palette.divider}`,
  marginBottom: theme.spacing(3),
  position: "relative",
}));

export const SectionHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: theme.spacing(1.75, 2.5),
  gap: theme.spacing(2),
  flexWrap: "wrap",
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.primary.main, 0.045),
}));

export const ModalActionsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing(2),
  width: "100%",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    gap: theme.spacing(1),
    "& > button": { width: "100%", minHeight: 44 },
  },
}));
