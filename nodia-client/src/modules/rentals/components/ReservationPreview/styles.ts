import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
export const PreviewStack = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
  minWidth: 0,
}));
export const PreviewHeader = styled(Box)({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
});
export const AmountRow = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: theme.spacing(1),
}));
