import { styled } from "@mui/material/styles";

export const AliasFields = styled("div")(({ theme }) => ({
  display: "grid", gap: theme.spacing(0.5), minWidth: 0,
}));

export const AliasHeader = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: theme.spacing(1), minWidth: 0,
  ".MuiFormControlLabel-root": { margin: 0, marginLeft: "auto", minHeight: 44, maxWidth: "100%" },
}));
