import { Alert, styled } from "@mui/material";

export const RecoveryAlert = styled(Alert)(({ theme }) => ({
  alignItems: "flex-start",
  flexWrap: "wrap",
  "& .MuiAlert-message": { minWidth: 0, flex: "1 1 160px", overflowWrap: "anywhere" },
  "& .MuiAlert-action": { margin: 0, padding: 0, width: "100%", "& button": { minHeight: 44, width: "100%" } },
  [theme.breakpoints.up("sm")]: { "& .MuiAlert-action": { width: "auto", "& button": { minHeight: 44, width: "auto" } } },
}));
