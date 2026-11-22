import { Button } from "@mui/material";
import { styled } from "@mui/material/styles";

export const FormContainer = styled("form")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(2),
  overflowWrap: "anywhere",
}));

export const ModalActions = styled("div")(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1.5),
  flexWrap: "wrap",
  justifyContent: "flex-end",
  [theme.breakpoints.down("sm")]: {
    "& > button": { width: "100%", minHeight: 44 },
  },
}));

export const PreviewAction = styled(Button)(({ theme }) => ({
  justifySelf: "start",
  [theme.breakpoints.down("sm")]: { width: "100%", minHeight: 44 },
}));

export const PreviewPanel = styled("section")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(1.5),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  "& h3:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const PreviewAmounts = styled("dl")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(10rem, 100%), 1fr))",
  gap: theme.spacing(1, 2),
  margin: 0,
  "& dt": {
    ...theme.typography.body2,
    color: theme.palette.text.secondary,
  },
  "& dd": {
    margin: 0,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
}));
