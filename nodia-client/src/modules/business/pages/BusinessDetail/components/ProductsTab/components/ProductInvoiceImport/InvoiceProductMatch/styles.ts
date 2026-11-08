import { Box, styled } from "@mui/material";

export const Comparison = styled(Box)(({ theme }) => ({
  display: "grid", gap: theme.spacing(1.5), minWidth: 0,
  "& .field": { display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: theme.spacing(1), padding: theme.spacing(1.5), border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius, minWidth: 0 },
  "& .values": { display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", gap: theme.spacing(1), alignItems: "start", overflowWrap: "anywhere", minWidth: 0 },
  "& .MuiFormControlLabel-root": { margin: 0, minHeight: 44 },
  [theme.breakpoints.up("sm")]: { "& .field": { gridTemplateColumns: "minmax(160px,1fr) minmax(0,2fr)", alignItems: "center" } },
}));
