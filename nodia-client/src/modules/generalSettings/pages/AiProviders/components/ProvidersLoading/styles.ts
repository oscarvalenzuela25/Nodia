import { Paper, styled } from "@mui/material";

export const LoadingPanel = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: Number(theme.shape.borderRadius) * 2,
  border: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(3) },
  [theme.breakpoints.up("md")]: { padding: theme.spacing(4) },
}));
