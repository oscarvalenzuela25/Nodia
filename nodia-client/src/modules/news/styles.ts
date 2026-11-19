import { Alert } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const NewsMasthead = styled("header")(({ theme }) => ({
  padding: theme.spacing(2.5, 2),
  color: theme.palette.text.primary,
  border: `1px solid ${theme.palette.divider}`,
  borderInlineStart: `3px solid ${theme.palette.primary.main}`,
  borderRadius: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  backgroundImage: `linear-gradient(115deg, ${alpha(theme.palette.primary.main, 0.075)}, transparent 62%)`,
  "& > *": { minWidth: 0 },
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(3) },
}));

export const NewsTitle = styled("h1")(({ theme }) => ({
  ...theme.typography.h4,
  fontSize: "1.5rem",
  fontWeight: 700,
  letterSpacing: "-0.035em",
  margin: theme.spacing(0, 0, 0.75),
  overflowWrap: "anywhere",
  [theme.breakpoints.up("sm")]: { fontSize: "1.875rem" },
  [theme.breakpoints.up("md")]: { fontSize: "2.125rem" },
}));

export const NewsIntroduction = styled("p")(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.palette.text.secondary,
  maxWidth: "62ch",
  margin: 0,
  overflowWrap: "anywhere",
}));

export const NewsRetryAlert = styled(Alert)(({ theme }) => ({
  [theme.breakpoints.down("sm")]: {
    flexWrap: "wrap",
    "& .MuiAlert-message": {
      flex: "1 1 0",
      minWidth: 0,
      overflowWrap: "anywhere",
    },
    "& .MuiAlert-action": {
      width: "100%",
      margin: 0,
      padding: 0,
      "& > button": { width: "100%", minHeight: 44 },
    },
  },
}));
