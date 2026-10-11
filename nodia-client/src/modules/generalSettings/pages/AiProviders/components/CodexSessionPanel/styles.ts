import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

export const SessionActions = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(2),
  width: "100%",
  flexDirection: "row",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    "& .MuiButton-root": { width: "100%", minHeight: 44 },
  },
}));
export const SessionContent = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
  minWidth: 0,
  overflowWrap: "anywhere",
  [theme.breakpoints.down("sm")]: { gap: theme.spacing(2) },
}));
