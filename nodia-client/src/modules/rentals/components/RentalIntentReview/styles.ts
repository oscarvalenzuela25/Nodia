import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
export const ReviewActions = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(2),
  flexWrap: "wrap",
  marginTop: theme.spacing(2),
  [theme.breakpoints.down("sm")]: { "& button": { width: "100%" } },
}));
