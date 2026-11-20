import { Box, Button, Stack } from "@mui/material";
import { alpha, styled, type Theme } from "@mui/material/styles";

const practiceSurface = ({ theme }: { theme: Theme }) => ({
  display: "grid",
  minWidth: 0,
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.5),
  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .055 : .025),
});

export const PracticeSurface = styled(Box)(practiceSurface);
export const PracticeForm = styled("form")(practiceSurface);

export const PracticeItem = styled(Stack)(({ theme }) => ({
  minWidth: 0,
  gap: theme.spacing(1),
  "& + &": {
    borderTop: `1px solid ${theme.palette.divider}`,
    paddingTop: theme.spacing(2),
  },
}));

export const PracticeActions = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing(1),
  "& > .MuiButton-root": {
    minHeight: 44,
    [theme.breakpoints.down("sm")]: { width: "100%" },
  },
}));

export const PracticeDisclosure = styled(Button)(({ theme }) => ({
  minHeight: 44,
  maxWidth: "100%",
  justifyContent: "space-between",
  textAlign: "start",
  [theme.breakpoints.down("sm")]: { width: "100%" },
}));

export const PracticeReference = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
  padding: theme.spacing(1.5, 2),
  borderInlineStart: `2px solid ${theme.palette.primary.main}`,
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.spacing(1),
}));
