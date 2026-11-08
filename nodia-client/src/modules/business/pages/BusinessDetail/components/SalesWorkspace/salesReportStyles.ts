import { Alert } from "@mui/material";
import { styled } from "@mui/material/styles";

export const ReportReadError = styled(Alert)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    flexWrap: "wrap",
    "& .MuiAlert-message": { minWidth: 0, flex: "1 1 0", overflowWrap: "anywhere" },
    "& .MuiAlert-action": { margin: 0, paddingLeft: 0, width: "100%", "& button": { width: "100%", minHeight: 44 } },
  },
}));
