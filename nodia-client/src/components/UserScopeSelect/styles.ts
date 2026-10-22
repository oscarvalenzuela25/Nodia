import { styled } from "@mui/material/styles";
export const Wrapper = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
  minWidth: 0,
  width: "100%",
}));
