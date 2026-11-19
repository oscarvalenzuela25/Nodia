import { alpha, styled } from "@mui/material/styles";

export { ContentWrapper, Description, Page, PrimaryButton, Title } from "../systemPageStyles";

export const IconWrapper = styled("div")(({ theme }) => ({
  display: "grid",
  placeItems: "center",
  width: 72,
  height: 72,
  borderRadius: theme.spacing(2),
  fontSize: "2.5rem",
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
}));
