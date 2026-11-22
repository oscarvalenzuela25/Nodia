import { styled } from "@mui/material/styles";

export const Information = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: theme.spacing(2),
  paddingBlockStart: theme.spacing(1.5),
  overflowWrap: "anywhere",
}));

export const StaySchedule = styled("dl")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(0.5),
  padding: theme.spacing(1.5, 2),
  margin: 0,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  "& dt": {
    color: theme.palette.text.secondary,
  },
  "& dd": {
    margin: 0,
  },
  "& dd:first-of-type": {
    color: theme.palette.text.primary,
    fontSize: theme.typography.h6.fontSize,
    fontWeight: 700,
  },
}));
