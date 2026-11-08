import { styled } from "@mui/material/styles";

export const ChipWrapper = styled("div")(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(1),
  backgroundColor: theme.palette.secondary.main,
  color: theme.palette.secondary.contrastText,
  padding: theme.spacing(1, 2),
  borderRadius: 4,
  ...theme.typography.body2,
  lineHeight: 1.5,
  whiteSpace: "nowrap",
  [theme.breakpoints.down("sm")]: {
    maxWidth: "100%",
    minWidth: 0,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    padding: theme.spacing(0.5, 1, 0.5, 2),
    "& .MuiIconButton-root": {
      width: 44,
      height: 44,
      flexShrink: 0,
    },
  },
}));
