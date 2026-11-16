import { Accordion, Box, Stack, styled } from "@mui/material";

export const Editor = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(3),
  minWidth: 0,
}));

export const Section = styled(Accordion)(({ theme }) => ({
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: `${theme.spacing(1.5)} !important`,
  backgroundImage: "none",
  minWidth: 0,
  "&:before": { display: "none" },
  "& .MuiAccordionSummary-root": { minHeight: 64 },
  "& .MuiAccordionSummary-content": { minWidth: 0 },
  "& .MuiAccordionDetails-root": {
    padding: theme.spacing(0, 2, 2),
  },
}));

export const SectionFields = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(2),
  minWidth: 0,
  paddingTop: theme.spacing(2),
  borderTop: `1px solid ${theme.palette.divider}`,
}));

export const UnitFields = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  minWidth: 0,
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.5),
}));

export const EditorActions = styled(Stack)(({ theme }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  "& > button": {
    minHeight: 44,
    [theme.breakpoints.down("sm")]: { width: "100%" },
  },
}));
