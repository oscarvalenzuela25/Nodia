import { styled } from "@mui/material/styles";
export const ReviewList = styled("section")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
}));
export const ReviewRow = styled("div")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));
