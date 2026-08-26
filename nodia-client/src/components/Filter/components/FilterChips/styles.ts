import { styled } from "@mui/material/styles";

export const ChipWrapper = styled("div")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(1),
  backgroundColor: theme.palette.secondary.main,
  color: theme.palette.secondary.contrastText,
  padding: theme.spacing(1, 2),
  borderRadius: 4,
  ...theme.typography.body2,
  lineHeight: 1.5,
  whiteSpace: "nowrap",
}));
