import { Box, Button } from "@mui/material";
import { styled } from "@mui/material/styles";
export const WorkspaceAction = styled(Button)(({ theme }) => ({
  alignSelf: "flex-end",
  [theme.breakpoints.down("sm")]: { width: "100%" },
}));
export const WorkspaceStack = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  minWidth: 0,
}));
