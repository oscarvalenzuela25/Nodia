import { Box, Chip, Paper } from "@mui/material";
import { styled } from "@mui/material/styles";

export const SettingsLayout = styled(Box)(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(3),
  alignContent: "start",
  width: "100%",
  maxWidth: 800,
}));

export const SectionCard = styled(Paper)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  boxShadow: "none",
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(2.5) },
}));

export const SectionHeading = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  "& > svg": { color: theme.palette.primary.main },
  "& > h2": { fontWeight: 650 },
}));

export const StatusChip = styled(Chip)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontWeight: 600,
}));

export const DeviceActions = styled(Box)(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  "&:empty": { display: "none" },
  "& .MuiButton-root": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& .MuiButton-root": { width: "100%" } },
}));
