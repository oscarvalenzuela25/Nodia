import { Alert, Chip, Stack, styled } from "@mui/material";
export const Status = styled(Stack)(({ theme }) => ({ gap: theme.spacing(1.5), minWidth: 0 }));
export const StatusNotice = styled(Alert)({
  minWidth: 0, overflowWrap: "anywhere", alignItems: "flex-start",
  "& .MuiAlert-message": { flex: "1 1 auto", minWidth: 0 },
});
export const StateChip = styled(Chip)(({ theme }) => ({
  maxWidth: "100%", height: "auto", minHeight: 28, fontWeight: 700,
  "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.4, padding: theme.spacing(.5, 1.25) },
}));
