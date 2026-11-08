import { styled } from "@mui/material/styles";

export const AudioContainer = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1), minWidth: 0, width: "100%",
  "& > audio": { display: "block", width: "100%", maxWidth: "100%", minWidth: 0, minHeight: 44, colorScheme: theme.palette.mode },
  "& > button": { alignSelf: "flex-start", minHeight: 44 },
  "& .MuiAlert-message": { minWidth: 0, overflowWrap: "anywhere" },
  [theme.breakpoints.down("sm")]: { "& > button": { width: "100%" } },
}));
