import { Box, Paper, styled, alpha } from "@mui/material";

export const ModalContentContainer = styled(Box)(() => ({
  display: "flex",
  flexDirection: "column",
  gap: 20,
}));

export const ProviderMetaHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 12,
  padding: "12px 16px",
  borderRadius: 12,
  backgroundColor:
    theme.palette.mode === "dark"
      ? alpha("#ffffff", 0.03)
      : alpha("#000000", 0.02),
  border: `1px solid ${theme.palette.divider}`,
}));

export const ModelsScrollContainer = styled(Box)(({ theme }) => ({
  minHeight: 400,
  maxHeight: 400,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  paddingTop: 4,
  paddingBottom: 4,
  paddingRight: 6,
  scrollbarWidth: "thin",
  scrollbarColor: `${
    theme.palette.mode === "dark"
      ? alpha("#ffffff", 0.2)
      : alpha("#000000", 0.2)
  } transparent`,
  "&::-webkit-scrollbar": {
    width: 6,
    height: 6,
  },
  "&::-webkit-scrollbar-track": {
    background: "transparent !important",
  },
  "&::-webkit-scrollbar-thumb": {
    borderRadius: 9999,
    backgroundColor:
      theme.palette.mode === "dark"
        ? alpha("#ffffff", 0.2)
        : alpha("#000000", 0.2),
    "&:hover": {
      backgroundColor:
        theme.palette.mode === "dark"
          ? alpha("#ffffff", 0.35)
          : alpha("#000000", 0.35),
    },
  },
  "&::-webkit-scrollbar-button": {
    display: "none !important",
    width: 0,
    height: 0,
  },
}));

export const DiscoveredModelCard = styled(Paper, {
  shouldForwardProp: (prop) => prop !== "selected",
})<{ selected?: boolean }>(({ theme, selected }) => ({
  padding: "12px 16px",
  borderRadius: 12,
  border: `1px solid ${
    selected
      ? alpha(theme.palette.primary.main, 0.5)
      : theme.palette.divider
  }`,
  backgroundColor: selected
    ? theme.palette.mode === "dark"
      ? alpha(theme.palette.primary.main, 0.08)
      : alpha(theme.palette.primary.main, 0.04)
    : theme.palette.mode === "dark"
    ? alpha("#ffffff", 0.02)
    : alpha("#000000", 0.01),
  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  boxShadow: "none",
  "&:hover": {
    borderColor: selected
      ? theme.palette.primary.main
      : theme.palette.mode === "dark"
      ? alpha("#ffffff", 0.3)
      : alpha("#000000", 0.3),
    transform: "translateY(-1px)",
  },
}));

export const ModelInfoBox = styled(Box)(() => ({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: 1,
  minWidth: 0,
}));

export const BadgesRow = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 4,
}));

export const RoleAssignmentBox = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 20,
  borderRadius: 14,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor:
    theme.palette.mode === "dark"
      ? alpha("#ffffff", 0.02)
      : alpha("#000000", 0.01),
}));

export const RolesVerticalStack = styled(Box)(() => ({
  display: "flex",
  flexDirection: "column",
  gap: 16,
  width: "100%",
}));

export const RoleCard = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 16,
  borderRadius: 12,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor:
    theme.palette.mode === "dark"
      ? alpha("#ffffff", 0.02)
      : alpha("#000000", 0.01),
  transition: "border-color 0.2s ease",
  "&:hover": {
    borderColor:
      theme.palette.mode === "dark"
        ? alpha("#ffffff", 0.2)
        : alpha("#000000", 0.2),
  },
}));

export const RoleCardHeader = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
}));

export const ModalActionsContainer = styled(Box)(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 12,
  width: "100%",
}));
