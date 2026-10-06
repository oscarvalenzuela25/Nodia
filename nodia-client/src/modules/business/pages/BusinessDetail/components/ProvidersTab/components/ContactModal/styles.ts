import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
export {
  SwitchWrapper,
  StyledFormControlLabel,
  StyledSwitch,
} from "../ProviderModal/styles";
export const ContactFormContainer = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
}));
export const PhoneRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(145px, 1fr) minmax(0, 2fr) auto",
  gap: theme.spacing(1),
  alignItems: "start",
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "minmax(0, 1fr) auto",
    "& > :first-child": { gridColumn: "1 / -1" },
  },
}));
export const DayRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: theme.spacing(2),
  padding: theme.spacing(2, 0),
  borderBottom: `1px solid ${theme.palette.divider}`,
  "& > :first-child, & > :last-child": { gridColumn: "1 / -1" },
}));
export const ContactActions = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  width: "100%",
  gap: theme.spacing(2),
  [theme.breakpoints.down("sm")]: { "& > button": { flex: 1 } },
}));
