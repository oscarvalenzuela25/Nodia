import { IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";

export const TitleLine = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", gap: theme.spacing(1), minWidth: 0, maxWidth: "100%",
  "& > span": { flexShrink: 0 },
}));

export const Heading = styled("h2")(({ theme }) => ({
  ...theme.typography.h6, margin: 0, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  fontSize: "1.25rem", [theme.breakpoints.down("sm")]: { fontSize: "1rem" },
}));

export const TitleAction = styled(IconButton)({
  width: 44, height: 44, flexShrink: 0,
});

export const Editor = styled("form")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1), minWidth: 0, width: "100%",
}));

export const EditorRow = styled("div")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", alignItems: "end", gap: theme.spacing(1), minWidth: 0,
}));

export const ErrorBlock = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: theme.spacing(1), minWidth: 0,
  "& > .MuiAlert-root": { width: "100%", boxSizing: "border-box", overflowWrap: "anywhere" },
  "& > button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& > button": { width: "100%" } },
}));
