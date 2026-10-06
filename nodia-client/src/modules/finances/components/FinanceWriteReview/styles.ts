import { Alert } from "@mui/material";
import { styled } from "@mui/material/styles";
export const ReviewAlert = styled(Alert)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    flexWrap: "wrap",
    "& .MuiAlert-action": {
      width: "100%",
      padding: theme.spacing(1, 0, 0),
      "& button": { width: "100%" },
    },
  },
}));
