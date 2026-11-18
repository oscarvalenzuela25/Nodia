import { styled } from "@mui/material/styles";

export const PickerRow = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 44px",
  alignItems: "start",
  gap: theme.spacing(1),
  minWidth: 0,
}));

export const QuickCategoryFields = styled("form")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  marginBottom: theme.spacing(1),
}));
