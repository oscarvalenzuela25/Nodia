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
