import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";

export const RunControl = styled(Box)(({ theme }) => ({
  minWidth: 0, maxWidth: "100%", display: "flex", flexDirection: "column", gap: theme.spacing(1.5), overflowWrap: "anywhere",
  "& .MuiButton-root": { minHeight: 44, alignSelf: "flex-start", [theme.breakpoints.down("sm")]: { width: "100%" } },
}));
