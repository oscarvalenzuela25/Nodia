import { alpha, styled } from "@mui/material/styles";

type Tone = "info" | "success" | "warning";
const toneProps = { shouldForwardProp: (prop: PropertyKey) => prop !== "$tone" };

export const QuestionBody = styled("article")(({ theme }) => ({
  display: "grid",
  minInlineSize: 0,
  gap: theme.spacing(2),
  "& > [role=status]:empty": { position: "absolute" },
  "& .MuiFormControlLabel-root": {
    minBlockSize: 48,
    minInlineSize: 0,
    margin: 0,
    padding: theme.spacing(.5, 1),
    borderRadius: theme.spacing(1.25),
    border: `1px solid ${theme.palette.divider}`,
    "&:has(.Mui-checked)": {
      borderColor: theme.palette.primary.main,
      backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity),
    },
    "&:has(.Mui-focusVisible)": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  "& .MuiFormControlLabel-label": { overflowWrap: "anywhere" },
}));

export const QuestionPrompt = styled("h3")(({ theme }) => ({
  ...theme.typography.h6,
  margin: 0,
  minInlineSize: 0,
  fontWeight: 700,
  overflowWrap: "anywhere",
  scrollMarginBlockStart: theme.spacing(2),
}));

export const DraftActions = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  "& > button, & > a": { minBlockSize: 44, maxInlineSize: "100%" },
  "& > .quiz-submit-answer": {
    marginInlineStart: "auto",
    [theme.breakpoints.down("sm")]: { inlineSize: "100%" },
  },
}));

export const Feedback = styled("section", toneProps)<{ $tone: Tone }>(({ theme, $tone }) => ({
  display: "grid",
  minInlineSize: 0,
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  border: `1px solid ${alpha(theme.palette[$tone].main, .36)}`,
  borderRadius: theme.spacing(1.75),
  backgroundColor: alpha(theme.palette[$tone].main, .035),
  overflowWrap: "anywhere",
  [theme.breakpoints.up("sm")]: { padding: theme.spacing(2.5) },
}));

export const FeedbackHeader = styled("header")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing(1.25),
}));

export const FeedbackIcon = styled("span", toneProps)<{ $tone: Tone }>(({ theme, $tone }) => ({
  inlineSize: theme.spacing(5),
  blockSize: theme.spacing(5),
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  borderRadius: theme.spacing(1.25),
  color: theme.palette[$tone].main,
  backgroundColor: alpha(theme.palette[$tone].main, .12),
}));

export const GradeBadge = styled("span", toneProps)<{ $tone: Tone }>(({ theme, $tone }) => ({
  ...theme.typography.body2,
  color: theme.palette[$tone].main,
  fontWeight: 700,
  backgroundColor: alpha(theme.palette[$tone].main, .10),
  borderRadius: theme.spacing(1),
  padding: theme.spacing(.625, 1.25),
}));

export const AnswerComparison = styled("div")(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))",
  gap: theme.spacing(1.25),
}));

export const AnswerSample = styled("dl")(({ theme }) => ({
  margin: 0,
  padding: theme.spacing(1.5),
  display: "grid",
  alignContent: "start",
  minInlineSize: 0,
  gap: theme.spacing(.5),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.25),
  backgroundColor: theme.palette.background.paper,
  "& dd": { margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
}));

export const RubricList = styled("ul")(({ theme }) => ({
  marginBlock: theme.spacing(.75, 0),
  padding: 0,
  listStyle: "none",
  "& > li": { display: "grid", gap: theme.spacing(.5), paddingBlock: theme.spacing(1) },
  "& > li + li": { borderBlockStart: `1px solid ${theme.palette.divider}` },
  "& > li:last-child": { paddingBlockEnd: 0 },
}));

export const FeedbackActions = styled("footer")(({ theme }) => ({
  display: "flex",
  justifyContent: "flex-end",
  borderBlockStart: `1px solid ${theme.palette.divider}`,
  paddingBlockStart: theme.spacing(1.5),
  "& > button, & > a": {
    maxInlineSize: "100%",
    minBlockSize: 44,
    [theme.breakpoints.down("sm")]: { inlineSize: "100%" },
  },
}));
