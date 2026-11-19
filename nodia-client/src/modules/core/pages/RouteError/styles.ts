import Button from "@mui/material/Button";
import { alpha, styled } from "@mui/material/styles";

export { ContentWrapper, Description, Page, PrimaryButton, Title } from "../systemPageStyles";

export const IconWrapper = styled("div")(({ theme }) => ({
  display: "grid",
  placeItems: "center",
  width: 72,
  height: 72,
  borderRadius: theme.spacing(2),
  fontSize: "2.5rem",
  color: theme.palette.error.main,
  backgroundColor: alpha(theme.palette.error.main, 0.12),
}));

export const Actions = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: theme.spacing(1.5),
  marginTop: theme.spacing(1),
  width: "100%",
}));

export const SecondaryButton = styled(Button)(({ theme }) => ({
  minHeight: 44,
  paddingInline: theme.spacing(3),
  [theme.breakpoints.down("sm")]: { width: "100%" },
}));
