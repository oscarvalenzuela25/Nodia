import { styled } from "@mui/material/styles";
export const PhoneFields = styled("div")(({ theme }) => ({
  minWidth: 0,
  gridColumn: "1 / -1",
  display: "grid",
  gap: theme.spacing(2),
  alignItems: "start",
  gridTemplateColumns: "minmax(0,1fr)",
  [theme.breakpoints.up("sm")]: {
    gridTemplateColumns: "minmax(0,220px) minmax(0,1fr)",
  },
}));
