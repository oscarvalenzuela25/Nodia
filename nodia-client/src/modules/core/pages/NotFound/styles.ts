import { styled } from "@mui/material/styles";

export { ContentWrapper, Description, Page, PrimaryButton, Title } from "../systemPageStyles";

export const ErrorCode = styled("div")(({ theme }) => ({
  color: theme.palette.primary.main,
  fontSize: "clamp(3.75rem, 13vw, 6.25rem)",
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.065em",
  lineHeight: 1,
}));
