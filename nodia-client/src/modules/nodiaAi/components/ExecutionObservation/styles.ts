import { alpha, styled } from "@mui/material/styles";
import { Button } from "@mui/material";

export const Observation = styled("section")(({ theme }) => ({
  minWidth: 0, display: "flex", flexDirection: "column", gap: theme.spacing(1.5),
}));
export const ResultCard = styled("article")(({ theme }) => ({
  minWidth: 0, border: `1px solid ${theme.palette.divider}`, borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1.5), display: "flex", flexDirection: "column", gap: theme.spacing(1),
  overflowWrap: "anywhere",
  "& button, & a": { minHeight: 44 },
  [theme.breakpoints.down("sm")]: { "& button, & a": { width: "100%" } },
}));

export const ProposalCard = styled("article")(({ theme }) => ({
  minWidth: 0, overflowWrap: "anywhere", borderRadius: 16,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
  "&[data-open=true]": { borderColor: alpha(theme.palette.primary.main, 0.45) },
}));
export const ProposalCardHeader = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(2),
  padding: theme.spacing(2.5), flexWrap: "wrap", minWidth: 0,
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) },
}));
export const ProposalCardIdentity = styled("div")(({ theme }) => ({
  display: "flex", alignItems: "center", gap: theme.spacing(1.5), minWidth: 0, flex: "1 1 240px",
}));
export const ProposalCardIcon = styled("span")(({ theme }) => ({
  display: "grid", placeItems: "center", width: 44, height: 44, flexShrink: 0, borderRadius: 12,
  color: theme.palette.primary.main, backgroundColor: alpha(theme.palette.primary.main, 0.12),
}));
export const ProposalCardToggle = styled(Button)(({ theme }) => ({
  minHeight: 44, flexShrink: 0,
  [theme.breakpoints.down("sm")]: { width: "100%" },
}));
export const ProposalCardContent = styled("div")(({ theme }) => ({
  minWidth: 0, padding: theme.spacing(0, 2.5, 2.5),
  "&[hidden]": { display: "none" },
  [theme.breakpoints.down("sm")]: { padding: theme.spacing(0, 2, 2) },
}));
