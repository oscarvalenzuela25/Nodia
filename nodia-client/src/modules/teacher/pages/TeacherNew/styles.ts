import { Stack, styled } from "@mui/material";
import { Fields } from "../../components/SessionForm/styles";

export const NewPlanForm = styled(Fields)(({ theme }) => ({ gap: theme.spacing(3), minWidth: 0 }));
export const CreateActions = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "flex-end",
  gap: theme.spacing(2),
  "& > button": { minHeight: 44, [theme.breakpoints.down("sm")]: { width: "100%" } },
}));
