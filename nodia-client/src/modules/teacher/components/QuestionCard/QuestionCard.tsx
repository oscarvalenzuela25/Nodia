import { useEffect, useId, useRef, type ReactNode, type Ref } from "react";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import RateReviewOutlined from "@mui/icons-material/RateReviewOutlined";
import { Alert, Box, Button, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import type { Answer, Question } from "../../infrastructure/schemas";
import { answerText } from "../../infrastructure/presentation";
import { useAnswerDraft } from "../../hooks/useAnswerDraft";
import {
  AnswerComparison, AnswerSample, DraftActions, Feedback, FeedbackActions, FeedbackHeader,
  FeedbackIcon, GradeBadge, QuestionBody, QuestionPrompt, RubricList,
} from "./styles";

type Props = {
  question: Question;
  busy: boolean;
  canSave: boolean;
  canSubmit: boolean;
  final: boolean;
  delivered: boolean;
  hintAction?: ReactNode;
  nextAction?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  onDraft: (answer: Answer | null) => void;
  onConflictChange?: (conflict: boolean) => void;
  onSave: (answer: Answer, expectedRevision: number) => Promise<number | null>;
  onSubmit: (answer: Answer) => Promise<void>;
};

export default function QuestionCard({
  question, busy, canSave, canSubmit, final, delivered, hintAction, nextAction, headingRef,
  onDraft, onConflictChange, onSave, onSubmit,
}: Props) {
  const { t } = useTranslation();
  const headingId = useId();
  const feedbackHeadingId = useId();
  const choiceLabelId = useId();
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const reviewing = delivered || Boolean(question.frozen_answer);
  const feedback = reviewing && (!final || delivered) ? question.feedback : null;
  const hasFeedback = Boolean(feedback);
  const wasReviewing = useRef(reviewing);
  const hadFeedback = useRef(hasFeedback);
  const editable = canSave && !reviewing;
  const draft = useAnswerDraft({ answer: question.frozen_answer ?? question.draft_answer, revision: question.response_revision, busy, editable, onDraft, onSave });
  useEffect(() => { onConflictChange?.(draft.conflict); }, [onConflictChange, draft.conflict]);
  useEffect(() => {
    const completedReview = hasFeedback && !hadFeedback.current && document.activeElement === document.body;
    if (reviewing && (!wasReviewing.current || completedReview)) reviewHeading.current?.focus();
    wasReviewing.current = reviewing;
    hadFeedback.current = hasFeedback;
  }, [reviewing, hasFeedback]);

  const { answer } = draft;
  const complete = answer !== null && (answer.kind === "dont_know" || answer.kind === "single_choice" || answer.text.trim().length > 0);
  const disabled = busy || draft.saving;
  const displayAnswer = (value: unknown) => {
    if (value && typeof value === "object" && "option_id" in value && typeof value.option_id === "string") {
      return question.options?.find(option => option.id === value.option_id)?.label ?? value.option_id;
    }
    if (value && typeof value === "object" && "kind" in value && value.kind === "dont_know") return t("teacher:dont_know");
    return answerText(value);
  };
  const submittedAnswer = displayAnswer(question.frozen_answer);
  const expectedAnswer = displayAnswer(feedback?.correct_answer);
  const earned = feedback?.earned_points ?? question.earned_points;
  const possible = feedback?.max_points ?? question.max_points;
  const hasScore = typeof earned === "number" && typeof possible === "number" && possible > 0 && earned >= 0 && earned <= possible;
  const fullCredit = hasScore && earned === possible;
  const tone = !hasScore ? "info" : fullCredit ? "success" : "warning";
  const feedbackTitle = !hasScore ? "teacher:feedback" : fullCredit ? "teacher:quiz_feedback.full_credit"
    : earned === 0 ? "teacher:quiz_feedback.review_answer" : "teacher:quiz_feedback.partial_credit";
  const change = draft.change;

  return <QuestionBody aria-labelledby={headingId}>
    <QuestionPrompt id={headingId} ref={headingRef} tabIndex={-1}>{question.prompt}</QuestionPrompt>
    {!reviewing && <>
      {question.kind === "single_choice" ? <FormControl disabled={disabled || !editable}>
        <FormLabel id={choiceLabelId}>{t("teacher:choose_answer")}</FormLabel>
        <RadioGroup aria-labelledby={choiceLabelId} value={answer?.kind === "single_choice" ? answer.option_id : answer?.kind === "dont_know" ? "dont_know" : ""} onChange={(_, value) => change(value === "dont_know" ? { kind: "dont_know" } : { kind: "single_choice", option_id: value })} sx={{ gap: 1, mt: 1 }}>
          {question.options?.map(option => <FormControlLabel key={option.id} value={option.id} control={<Radio />} label={option.label} />)}
          <FormControlLabel value="dont_know" control={<Radio />} label={t("teacher:dont_know")} />
        </RadioGroup>
      </FormControl> : <Stack sx={{ gap: 1 }}>
        <TextInput label={t("teacher:your_answer")} value={answer?.kind === "completion" || answer?.kind === "short_text" ? answer.text : ""} onChange={event => change({ kind: question.kind === "short_text" ? "short_text" : "completion", text: event.target.value })} disabled={disabled || !editable} error={answer !== null && !draft.valid} helperText={answer !== null && !draft.valid ? t("teacher:answer_length") : undefined} multiline={question.kind === "short_text"} minRows={question.kind === "short_text" ? 3 : 1} />
        <Button type="button" variant={answer?.kind === "dont_know" ? "contained" : "outlined"} aria-pressed={answer?.kind === "dont_know"} disabled={disabled || !editable} sx={{ alignSelf: "flex-start", minHeight: 44 }} onClick={() => change({ kind: "dont_know" })}>{t("teacher:dont_know")}</Button>
      </Stack>}
      <DraftActions>
        <Button type="button" variant="outlined" loading={draft.saving} disabled={disabled || !editable || !answer || !draft.dirty || !draft.valid} onClick={() => void draft.save()}>{t("teacher:save_answer")}</Button>
        {hintAction}
        {!final && <Button type="button" className="quiz-submit-answer" variant="contained" disabled={disabled || !canSubmit || !complete || !draft.valid} onClick={() => { if (answer) void onSubmit(answer); }}>{t("teacher:submit_answer")}</Button>}
      </DraftActions>
      <div role="status">
        {(answer || draft.dirty || draft.saving) && draft.status !== "conflict" && <Typography variant="body2" color={draft.dirty || draft.status === "save_failed" ? "warning.main" : "text.secondary"}>{t("teacher:" + draft.status)}</Typography>}
      </div>
      {draft.status === "conflict" && <Alert severity="warning">{t("teacher:answer_conflict", { answer: displayAnswer(draft.confirmedAnswer) })}</Alert>}
    </>}
    {final && !delivered && <Alert severity="info">{t("teacher:final_no_feedback")}</Alert>}
    {question.frozen_answer && !feedback && <Stack sx={{ gap: 1.5 }}>
      <Typography ref={reviewHeading} tabIndex={-1} variant="subtitle1" component="h4">{t("teacher:response_submitted")}</Typography>
      {submittedAnswer && <AnswerSample>
        <Typography component="dt" variant="subtitle2" color="text.secondary">{t("teacher:your_answer")}</Typography>
        <Typography component="dd">{submittedAnswer}</Typography>
      </AnswerSample>}
      {["pending", "needs_review"].includes(question.grade_state ?? "") && <Alert severity="info" role="status">{t("teacher:feedback_pending")}</Alert>}
    </Stack>}
    {feedback && <Feedback $tone={tone} aria-labelledby={feedbackHeadingId}>
      <FeedbackHeader>
        <FeedbackIcon $tone={tone}>
          {fullCredit ? <CheckCircleOutlined /> : hasScore ? <RateReviewOutlined /> : <InfoOutlined />}
        </FeedbackIcon>
        <Typography id={feedbackHeadingId} ref={reviewHeading} tabIndex={-1} component="h4" variant="h6" sx={{ flex: "1 1 12rem", fontWeight: 700 }}>{t(feedbackTitle)}</Typography>
        {hasScore && <GradeBadge $tone={tone}>{t("teacher:points", { earned, possible })}</GradeBadge>}
      </FeedbackHeader>
      {(submittedAnswer || expectedAnswer) && <AnswerComparison>
        {submittedAnswer && <AnswerSample>
          <Typography component="dt" variant="subtitle2" color="text.secondary">{t("teacher:your_answer")}</Typography>
          <Typography component="dd">{submittedAnswer}</Typography>
        </AnswerSample>}
        {expectedAnswer && (!fullCredit || expectedAnswer !== submittedAnswer) && <AnswerSample>
          <Typography component="dt" variant="subtitle2" color="text.secondary">{t("teacher:quiz_feedback.expected_answer")}</Typography>
          <Typography component="dd">{expectedAnswer}</Typography>
        </AnswerSample>}
      </AnswerComparison>}
      {feedback.expected_explanation && <Box>
        <Typography component="h5" variant="subtitle2">{t("teacher:quiz_feedback.expected_explanation")}</Typography>
        <Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{feedback.expected_explanation}</Typography>
      </Box>}
      <Box>
        <Typography component="h5" variant="subtitle2">{t("teacher:quiz_feedback.explanation")}</Typography>
        <Typography color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{feedback.explanation || t("teacher:explanation_pending")}</Typography>
      </Box>
      {Boolean(feedback.criteria?.length) && <Box>
        <Typography component="h5" variant="subtitle2">{t("teacher:quiz_feedback.criteria")}</Typography>
        <RubricList>
          {feedback.criteria?.map(criterion => <li key={criterion.criterion_id}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 1 }}>
              <Typography variant="subtitle2">{t("teacher:criteria." + criterion.criterion_id)}</Typography>
              <Typography variant="body2" color="text.secondary">{t("teacher:quiz_feedback.criterion_points", { count: criterion.points })}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>{criterion.comment}</Typography>
          </li>)}
        </RubricList>
      </Box>}
      {!final && nextAction && <FeedbackActions>{nextAction}</FeedbackActions>}
    </Feedback>}
  </QuestionBody>;
}
