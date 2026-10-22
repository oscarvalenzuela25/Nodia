import { Button } from "@mui/material";
import { styled } from "@mui/material/styles";

export const ChangeAccountButton = styled(Button)(({ theme }) => ({
  textTransform: "none",
  minHeight: 44,
  [theme.breakpoints.down("sm")]: { width: "100%" },
}));
