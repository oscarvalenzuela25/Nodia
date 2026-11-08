import { Box, Button } from "@mui/material";
import { styled } from "@mui/material/styles";

export const MethodGrid = styled(Box)(({ theme }) => ({
  display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: theme.spacing(1),
  "& > button:nth-of-type(n+3)": { gridColumn: "span 2" },
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    "& > button:nth-of-type(-n+3)": { gridColumn: "span 2" },
    "& > button:nth-of-type(n+4)": { gridColumn: "span 6" },
  },
}));
export const MethodButton = styled(Button)(({ theme }) => ({
  position: "relative", minWidth: 0, minHeight: 84, padding: theme.spacing(1.5, 1),
  display: "flex", flexDirection: "column", gap: theme.spacing(.75), fontSize: theme.typography.body1.fontSize,
  lineHeight: 1.3, fontWeight: 600, textTransform: "none", overflowWrap: "anywhere", borderRadius: theme.spacing(1.5),
}));
