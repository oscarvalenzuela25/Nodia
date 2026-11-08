import { Box, styled } from "@mui/material";

export const LoadingRegion = styled(Box)({ minWidth: 0 });
export const LoadingSpace = styled(Box, { shouldForwardProp: prop => prop !== "compact" })<{ compact: boolean }>(({ compact }) => ({
  minWidth: 0, width: compact ? 160 : "100%", maxWidth: "100%", height: compact ? 32 : 160,
}));
