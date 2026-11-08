import { alpha, styled } from "@mui/material/styles";
import { Box, Chip, FormControlLabel, Paper, Stack, Typography } from "@mui/material";

export const ProductBrand = styled(Typography)(({ theme }) => ({
  fontFamily: '"Karmatic Arcade", monospace, sans-serif',
  fontWeight: 400,
  fontSize: "2.125rem",
  letterSpacing: 0,
  display: "inline-block",
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.tertiary?.main ?? theme.palette.secondary.main} 100%)`,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  [theme.breakpoints.down("sm")]: { fontSize: "1.5rem" },
}));
export const PlanFilters = styled(Stack)(({ theme }) => ({ gap: theme.spacing(1), alignItems: "flex-start", [theme.breakpoints.up("sm")]: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", columnGap: theme.spacing(2) } }));
export const PlanSearch = styled(Box)(({ theme }) => ({ width: "100%", minWidth: 0, [theme.breakpoints.up("sm")]: { width: "50%" } }));
export const ArchivedFilter = styled(FormControlLabel)(({ theme }) => ({ margin: 0, minHeight: 44, "& .MuiFormControlLabel-label": { ...theme.typography.body2 } }));
export const StateChip = styled(Chip)(({ theme }) => ({ fontWeight: theme.typography.fontWeightBold }));

export const Page = styled(Stack)(({ theme }) => ({ gap: theme.spacing(3), minWidth: 0, "& .MuiButton-root": { minHeight: 44 }, "& .MuiIconButton-root": { width: 44, height: 44 } }));
export const SessionPage = styled(Page)(({ theme }) => ({ gap: theme.spacing(1) }));
export const Header = styled(Box)(({ theme }) => ({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: theme.spacing(2), flexWrap: "wrap", "& > button": { [theme.breakpoints.down("sm")]: { width: "100%" } } }));
export const Panel = styled(Paper)(({ theme }) => ({ padding: theme.spacing(3), borderRadius: theme.spacing(2), border: `1px solid ${theme.palette.divider}`, backgroundImage: "none", minWidth: 0, overflowWrap: "anywhere", [theme.breakpoints.down("sm")]: { padding: theme.spacing(2) } }));
export const Workspace = styled(Box)(({ theme }) => ({ display: "grid", gridTemplateColumns: "minmax(0,1fr)", alignItems: "start", gap: theme.spacing(3, 2), [theme.breakpoints.up("md")]: { gridTemplateColumns: "minmax(240px, 320px) minmax(0, 1fr)" } }));
export const PlanGrid = styled(Box)(({ theme }) => ({ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: theme.spacing(3, 2), [theme.breakpoints.up("sm")]: { gridTemplateColumns: "repeat(2,minmax(0,1fr))" }, [theme.breakpoints.up("xl")]: { gridTemplateColumns: "repeat(3,minmax(0,1fr))" } }));
export const Actions = styled(Stack)(({ theme }) => ({ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing(1), "& > button, & > a": { minHeight: 44, [theme.breakpoints.down("sm")]: { width: "100%" } } }));
export const LessonHeader = styled(Box)(({ theme }) => ({ padding: theme.spacing(3), borderRadius: theme.spacing(1.5), borderLeft: `4px solid ${theme.palette.primary.main}`, background: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.13 : 0.055), marginBottom: theme.spacing(3) }));
export const QuestionBody = styled(Stack)(({ theme }) => ({ gap: theme.spacing(2), "& .MuiFormControlLabel-root": { minHeight: 48, margin: 0, borderRadius: theme.spacing(1), border: `1px solid ${theme.palette.divider}`, padding: theme.spacing(.5, 1) }, "& .MuiFormControlLabel-label": { overflowWrap: "anywhere" } }));
