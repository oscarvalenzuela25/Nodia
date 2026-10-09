import { styled } from "@mui/material/styles";
import { Badge, Stack } from "@mui/material";

export const Indicators = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-end",
  gridColumn: "1 / -1",
  gridRow: 2,
  gap: theme.spacing(0.5),
  [theme.breakpoints.up("sm")]: {
    gridColumn: 2,
    gridRow: 1,
  },
}));

export const StatusBadge = styled(Badge)(({ theme }) => ({
  "& .MuiBadge-badge": {
    width: 8,
    height: 8,
    minWidth: 8,
    borderRadius: "50%",
    boxShadow: `0 0 0 2px ${theme.palette.background.default}`,
  },
}));
