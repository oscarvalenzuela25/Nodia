import { Button, Stack } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const SourceForm = styled("form")(({ theme }) => ({
  display: "grid",
  gap: theme.spacing(2),
  minWidth: 0,
  padding: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(2),
  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.055 : 0.025),
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(3) },
}));

export const SourceFormats = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: theme.spacing(1),
  "& button": { minHeight: 44, minWidth: 0, overflowWrap: "anywhere" },
  "& .MuiButton-startIcon": { flexShrink: 0 },
}));

export const PdfPicker = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(1.5),
  minWidth: 0,
  alignItems: "stretch",
  padding: theme.spacing(2),
  border: `1px dashed ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.5),
  backgroundColor: theme.palette.background.paper,
  "& svg": { flexShrink: 0 },
}));

export const SourceActions = styled(Stack)(({ theme }) => ({
  gap: theme.spacing(1),
  "& button": { minHeight: 44 },
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
}));

export const SourceListButton = styled(Button)(({ theme }) => ({
  display: "flex",
  justifyContent: "space-between",
  textAlign: "start",
  gap: theme.spacing(1),
  minHeight: 58,
  minWidth: 0,
  padding: theme.spacing(1, 1.5),
  "& svg": { flexShrink: 0 },
}));

export const SourcePreview = styled(Stack)(({ theme }) => ({
  minWidth: 0,
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.action.hover,
  overflowWrap: "anywhere",
}));
