import { Button, Stack, styled } from "@mui/material";
import { Panel } from "../Teacher/styles";
import { Fields } from "../../components/SessionForm/styles";

export const NewPlanForm = styled(Fields)(({ theme }) => ({ gap: theme.spacing(3), minWidth: 0 }));
export const CreateActions = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: theme.spacing(2),
  "& > button": { minHeight: 44, [theme.breakpoints.down("sm")]: { width: "100%" } },
}));

export const StepList = styled("ol")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: theme.spacing(2),
  listStyle: "none", margin: 0, padding: 0, minWidth: 0,
  "& li": { minWidth: 0 },
  [theme.breakpoints.down("sm")]: { gap: theme.spacing(1) },
}));
export const StepButton = styled(Button)(({ theme }) => ({
  width: "100%", minWidth: 0, minHeight: 56, height: "100%", justifyContent: "flex-start", gap: theme.spacing(1.5), textAlign: "left",
  color: theme.palette.text.secondary, borderColor: theme.palette.divider,
  "&[aria-current=step]": { borderColor: theme.palette.primary.main, color: theme.palette.primary.main },
  "& .step-number": { display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: 28, height: 28, borderRadius: "50%", border: "1px solid currentColor" },
  "& .step-label": { overflowWrap: "anywhere" },
  [theme.breakpoints.down("sm")]: { justifyContent: "center", "& .step-label": { display: "none" } },
}));
export const SetupLayout = styled("div")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: theme.spacing(3, 2), alignItems: "start", minWidth: 0,
  [theme.breakpoints.up("lg")]: { gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 340px)" },
}));
export const StudyNote = styled(Panel)(({ theme }) => ({
  borderTop: `3px solid ${theme.palette.primary.main}`, boxShadow: "none",
}));
export const SummaryEntry = styled("div")({ minWidth: 0, overflowWrap: "anywhere", "& dd": { margin: 0, whiteSpace: "pre-wrap" } });
