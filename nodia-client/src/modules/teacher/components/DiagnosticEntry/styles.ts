import { Button, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";

export const Content = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(2),
  minWidth: 0,
  overflowWrap: "anywhere",
  "& .MuiAlert-action button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: {
    "& .MuiAlert-root": { flexWrap: "wrap" },
    "& .MuiAlert-action": { width: "100%", marginLeft: 0, paddingLeft: 0 },
    "& .MuiAlert-action button": { width: "100%" },
  },
}));

export const DiagnosticButton = styled(Button)(({ theme }) => ({
  minHeight: 44,
  [theme.breakpoints.down("sm")]: { width: "100%" },
}));
