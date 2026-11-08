import { styled } from "@mui/material/styles";

export const ActivityShell = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", minWidth: 0, width: "100%", minHeight: 44,
  color: theme.palette.text.secondary, overflowWrap: "anywhere",
}));

export const ActivityCanvas = styled("canvas")({
  display: "block", width: "100%", maxWidth: "100%", minWidth: 0, height: 44,
  "&[hidden]": { display: "none" },
});
