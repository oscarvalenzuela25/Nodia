import { styled } from "@mui/material/styles";

export const AttachmentPanel = styled("section")(({ theme }) => ({
  display: "flex", flexDirection: "column", gap: theme.spacing(1.5), minWidth: 0,
  gridColumn: "1 / -1", overflowWrap: "anywhere",
  "& > *": { flexShrink: 0 },
  "& button": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& button": { width: "100%" } },
}));
export const AttachmentCard = styled("article")(({ theme }) => ({
  minWidth: 0, padding: theme.spacing(1.5), border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius, display: "flex", flexDirection: "column", gap: theme.spacing(1),
  overflowWrap: "anywhere",
  "& button": { minHeight: 44, [theme.breakpoints.down("sm")]: { width: "100%" } },
}));
