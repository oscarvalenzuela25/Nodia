import { Alert } from "@mui/material";
import { styled } from "@mui/material/styles";

export const ErrorAlert = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  minWidth: 0,
  overflowWrap: "anywhere",
  [theme.breakpoints.down("sm")]: {
    flexWrap: "wrap",
    "& .MuiAlert-message": { minWidth: 0, flex: "1 1 160px" },
    "& .MuiAlert-action": { width: "100%", margin: 0, padding: 0 },
    "& .MuiButton-root": { width: "100%", minHeight: 44 },
  },
}));
