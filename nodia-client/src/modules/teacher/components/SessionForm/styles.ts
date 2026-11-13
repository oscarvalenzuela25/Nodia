import { styled } from "@mui/material";
export const Fields = styled("form")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  "& .MuiOutlinedInput-root.MuiInputBase-multiline": {
    padding: "10px 14px",
    "& .MuiOutlinedInput-input": { padding: 0 },
  },
}));

export const Introduction = styled("div")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(.5), minWidth: 0,
  "& h2": { fontWeight: theme.typography.fontWeightBold },
}));
export const FieldGrid = styled("div")(({ theme }) => ({
  display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: theme.spacing(3, 2), minWidth: 0,
  [theme.breakpoints.up("sm")]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
}));
export const FieldSlot = styled("div", { shouldForwardProp: prop => prop !== "wide" })<{ wide?: boolean }>(({ wide }) => ({
  minWidth: 0, ...(wide ? { gridColumn: "1 / -1" } : {}),
}));
