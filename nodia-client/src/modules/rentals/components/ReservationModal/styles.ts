import { alpha, styled } from "@mui/material/styles";
export const FieldGrid = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr)",
  gap: theme.spacing(2),
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  },
}));
export const QuoteSummary = styled("div")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(0.5),
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  background: alpha(theme.palette.primary.main, 0.08),
  overflowWrap: "anywhere",
}));
export const WizardProgress = styled("ol")(({ theme }) => ({
  margin: 0,
  padding: 0,
  listStyle: "none",
  borderBottom: `1px solid ${theme.palette.divider}`,
  paddingBottom: theme.spacing(2),
  "& .MuiStepLabel-label": {
    color: theme.palette.text.secondary,
    "&.Mui-active": { color: theme.palette.text.primary, fontWeight: 700 },
  },
}));
export const ReviewSummary = styled("section")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.5),
}));
export const ReviewGroup = styled("section")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(1.5),
  alignContent: "start",
  justifyItems: "start",
  minWidth: 0,
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflowWrap: "anywhere",
  "& > button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: {
    "& > button": { width: "100%" },
  },
}));
export const ReviewValues = styled("dl")(({ theme }) => ({
  ...theme.typography.body2,
  display: "grid",
  gap: theme.spacing(0.75),
  margin: 0,
  width: "100%",
  "& > div": {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: theme.spacing(0.25, 1),
  },
  "& dt": { color: theme.palette.text.secondary },
  "& dd": { margin: 0, minWidth: 0, fontWeight: 600 },
}));
export const WizardActions = styled("div")(({ theme }) => ({
  display: "flex",
  width: "100%",
  gap: theme.spacing(1),
  flexWrap: "wrap",
  justifyContent: "flex-end",
  [theme.breakpoints.down("sm")]: {
    flexDirection: "column",
    "& > button": { width: "100%", minHeight: 44 },
  },
}));
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
  [theme.breakpoints.down("sm")]: {
    "& > button": { width: "100%", minHeight: 44 },
  },
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
