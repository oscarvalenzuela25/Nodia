import { styled } from "@mui/material/styles";
export const Wrapper = styled("section")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(3),
}));
export const Filters = styled("div")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
}));
export const FormContainer = styled("form")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
}));
export const ModalActions = styled("div")(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(2),
  flexWrap: "wrap",
  justifyContent: "flex-end",
  [theme.breakpoints.down("sm")]: { "& > button": { width: "100%" } },
}));
export const DetailList = styled("section")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
}));
export const ReviewContainer = DetailList;
export const Information = DetailList;
export const Toolbar = ModalActions;
export const CalendarGrid = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(7,minmax(0,1fr))",
  gap: theme.spacing(1),
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  },
  [theme.breakpoints.down("sm")]: { gridTemplateColumns: "minmax(0,1fr)" },
}));
export const DayPanel = styled("article")(({ theme }) => ({
  padding: theme.spacing(1),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  display: "grid",
  alignContent: "start",
  gap: theme.spacing(1),
  overflowWrap: "anywhere",
  "& button": {
    whiteSpace: "normal",
    textAlign: "left",
    justifyContent: "flex-start",
  },
}));
export const Agenda = styled("div")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
}));
