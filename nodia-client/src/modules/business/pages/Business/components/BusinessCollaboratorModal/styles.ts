import { Box, Card } from "@mui/material";
import { styled } from "@mui/material/styles";

export const ModalContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2.5),
}));

export const CollaboratorItemCard = styled(Card)(({ theme }) => {
  const borderColor = theme.palette.divider;

  return {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    borderRadius: 8,
    border: `1px solid ${borderColor}`,
    boxShadow: "none",
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255, 255, 255, 0.02)"
        : "rgba(0, 0, 0, 0.01)",
  };
});

export const CollaboratorCardHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(1),
}));

export const ModalActionsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing(2),
  width: "100%",
}));
