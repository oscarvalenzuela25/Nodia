import { Button } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export const Fragment = styled("section")(({ theme }) => ({
  containerType: "inline-size",
  display: "grid",
  gap: theme.spacing(1.25),
  minWidth: 0,
  padding: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette.primary.main, .3)}`,
  borderRadius: theme.spacing(2),
  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .08 : .04),
  "& > h4": { fontWeight: 700 },
  "& > [role=status]:empty": { marginBlockStart: theme.spacing(-1.25) },
}));

export const CompareGrid = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: theme.spacing(1),
}));

export const Choice = styled(Button)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(.25),
  minWidth: 0,
  padding: theme.spacing(1.5, .5),
  borderRadius: theme.spacing(1.5),
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  textTransform: "none",
  "& > :first-of-type": { fontWeight: 800 },
  "& > :last-of-type": { color: theme.palette.text.secondary },
  "& strong": {
    paddingInline: theme.spacing(.35),
    borderRadius: theme.spacing(.5),
    backgroundColor: alpha(theme.palette.primary.main, .17),
    color: theme.palette.text.primary,
  },
  '&[aria-pressed="true"]': {
    borderColor: theme.palette.primary.main,
    boxShadow: `inset 0 0 0 1px ${theme.palette.primary.main}`,
    backgroundColor: alpha(theme.palette.primary.main, .12),
  },
  "&.Mui-focusVisible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));

export const Sequence = styled("ol")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: theme.spacing(1),
  listStyle: "none",
  padding: 0,
  margin: 0,
  "& > li": { display: "flex", minWidth: 0 },
  "@container (min-width: 32rem)": { gridTemplateColumns: "repeat(6, minmax(0, 1fr))" },
}));

export const Tile = styled(Choice)(({ theme }) => ({
  width: "100%",
  paddingInline: theme.spacing(.25),
  borderColor: theme.palette.divider,
  "& > :last-of-type": { fontSize: theme.typography.pxToRem(12), fontWeight: 700, overflowWrap: "anywhere" },
  '&[aria-expanded="true"]': {
    borderColor: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, .12),
    "& > :last-of-type": { color: theme.palette.text.primary },
  },
}));

export const Feedback = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing(1),
  padding: theme.spacing(1, 1.25),
  borderRadius: theme.spacing(1),
  backgroundColor: alpha(theme.palette.info.main, .1),
  "& > svg": { flexShrink: 0 },
  '&[data-correct="true"]': { backgroundColor: alpha(theme.palette.success.main, .12) },
}));
