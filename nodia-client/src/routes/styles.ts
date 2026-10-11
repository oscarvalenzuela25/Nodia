import { Alert } from "@mui/material";
import { styled } from "@mui/material/styles";

export const GuardNotice = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  "& .MuiAlert-message": { minWidth: 0, overflowWrap: "anywhere" },
  [theme.breakpoints.down("sm")]: {
    flexWrap: "wrap",
    "& .MuiAlert-message": { flex: 1 },
    "& .MuiAlert-action": {
      width: "100%",
      padding: 0,
      margin: theme.spacing(1, 0, 0),
      "& button": { width: "100%", minHeight: 44 },
    },
  },
}));
