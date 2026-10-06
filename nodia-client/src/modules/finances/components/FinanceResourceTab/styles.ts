import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

export const ResourceContent = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
}));
