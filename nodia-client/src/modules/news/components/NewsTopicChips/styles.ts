import { Button } from "@mui/material";
import { styled } from "@mui/material/styles";

export const TopicGroup = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  minWidth: 0,
}));

export const TopicChip = styled(Button)(({ theme }) => ({
  minHeight: 44,
  maxWidth: "100%",
  padding: theme.spacing(0.75, 2),
  borderRadius: 9999,
  borderColor: theme.palette.divider,
  color: theme.palette.text.secondary,
  backgroundColor: "transparent",
  fontWeight: 600,
  textTransform: "none",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  transition: theme.transitions.create(["background-color", "border-color", "color"], {
    duration: theme.transitions.duration.shorter,
  }),
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.text.secondary,
  },
  "&[aria-pressed='true']": {
    backgroundColor: theme.palette.primary.main,
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    "&:hover": {
      backgroundColor: theme.palette.primary.main,
      borderColor: theme.palette.primary.main,
    },
  },
  "&.Mui-focusVisible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 3,
  },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
  },
}));
