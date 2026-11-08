import { Button, styled } from "@mui/material";

export const GenerateButton = styled(Button)(({ theme }) => ({
  minHeight: 44,
  [theme.breakpoints.down("sm")]: { width: "100%", minHeight: 48 },
}));
