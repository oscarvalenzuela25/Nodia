import { styled } from "@mui/material/styles";
import { Box } from "@mui/material";

export const Content = styled("form")({ minWidth: 0 });
export const Actions = styled(Box)(({ theme }) => ({
  display: "flex", justifyContent: "flex-end", gap: theme.spacing(2), width: "100%",
  [theme.breakpoints.down("sm")]: { flexDirection: "column-reverse", "& button": { width: "100%", minHeight: 44 } },
}));
