import { styled } from "@mui/material/styles";
import { Button, Stack } from "@mui/material";

export const Content = styled(Stack)(({ theme }) => ({ gap: theme.spacing(2), minWidth: 0, overflowWrap: "anywhere" }));
export const UnitButton = styled(Button)(({ theme }) => ({ minHeight: 44, alignSelf: "flex-start", whiteSpace: "normal", textAlign: "start", [theme.breakpoints.down("sm")]: { width: "100%" } }));
