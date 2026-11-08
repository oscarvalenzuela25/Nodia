import { Box, Chip, Stack, styled } from "@mui/material";
export const Status = styled(Stack)(({ theme }) => ({ gap: theme.spacing(2) }));
export const ProgressSpace = styled(Box)({ minHeight: 4 });

export const InlineStatusRow = styled(Box)(({ theme }) => ({
  display: "flex", alignItems: "center", gap: theme.spacing(1), minWidth: 0, maxWidth: "100%", width: "fit-content",
  "& > span": { flexShrink: 0 },
}));
export const InlineStatusValue = styled(Box)({ minWidth: 0, flex: "0 1 auto" });
export const StateChip = styled(Chip)(({ theme }) => ({
  maxWidth: "100%", height: "auto", minHeight: 28, fontWeight: 700,
  "& .MuiChip-label": { whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.4, padding: theme.spacing(.5, 1.25) },
}));
