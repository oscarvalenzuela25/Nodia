import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
export const DateTimeFields = styled(Box)(({ theme }) => ({
  minWidth: 0,
  display: "grid",
  gap: theme.spacing(1),
}));
export const GroupLabel = styled("div")(({ theme }) => ({
  ...theme.typography.body2,
  fontWeight: 600,
  color: theme.palette.text.primary,
}));
export const DateTimeRow = styled(Box)(({ theme }) => ({
  minWidth: 0,
  display: "grid",
  gap: theme.spacing(2),
  gridTemplateColumns: "minmax(0,1fr)",
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)",
  },
}));
