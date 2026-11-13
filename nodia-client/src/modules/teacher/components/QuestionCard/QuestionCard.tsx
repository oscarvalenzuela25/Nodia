import ResponseReflection from "../AdaptiveWorkspace/ResponseReflection";
import { Alert, Button, FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import type { Answer, Question } from "../../infrastructure/schemas";
import { answerText } from "../../infrastructure/presentation";
import { useAnswerDraft } from "../../hooks/useAnswerDraft";
import { Actions, QuestionBody } from "../../pages/Teacher/styles";
import { Feedback } from "./styles";

type Props = { onReflectionSave?: (value: { self_explanation: string | null; confidence: number | null }) => Promise<boolean>; question: Question; busy: boolean; canSave: boolean; canSubmit: boolean; final: boolean; delivered: boolean; onDraft: (answer: Answer | null) => void; onConflictChange?: (conflict: boolean) => void; onSave: (answer: Answer, expectedRevision: number) => Promise<number | null>; onSubmit: (answer: Answer) => Promise<void> };
export default function QuestionCard({ question, busy, canSave, canSubmit, final, delivered, onDraft, onConflictChange, onSave, onSubmit, onReflectionSave }: Props) {
  const { t } = useTranslation();
  const editable = canSave && !delivered && !question.frozen_answer;
  const draft = useAnswerDraft({ answer: question.frozen_answer ?? question.draft_answer, revision: question.response_revision, busy, editable, onDraft, onSave });
  const [reflectionDirty, setReflectionDirty] = useState(false);
  useEffect(() => { onConflictChange?.(draft.conflict || reflectionDirty); }, [onConflictChange, draft.conflict, reflectionDirty]);
  const { answer } = draft;
  const complete = answer !== null && (answer.kind === "dont_know" || answer.kind === "single_choice" || answer.text.trim().length > 0);
  const disabled = busy || draft.saving;
  const feedback = (!final || delivered) ? question.feedback : null;
  const displayAnswer = (value: unknown) => {
    if (value && typeof value === "object" && "option_id" in value && typeof value.option_id === "string") return question.options?.find(option => option.id === value.option_id)?.label ?? value.option_id;
    return answerText(value);
  };
  const change = draft.change;
  return <QuestionBody>
    <Typography variant="h6" component="h3">{question.prompt}</Typography>
    {question.kind === "single_choice" ? <FormControl disabled={disabled || !editable}>
      <FormLabel id={`teacher-answer-${question.question_id}`}>{t("teacher:choose_answer")}</FormLabel>
      <RadioGroup aria-labelledby={`teacher-answer-${question.question_id}`} value={answer?.kind === "single_choice" ? answer.option_id : answer?.kind === "dont_know" ? "dont_know" : ""} onChange={(_, value) => change(value === "dont_know" ? { kind: "dont_know" } : { kind: "single_choice", option_id: value })} sx={{ gap: 1, mt: 1 }}>
        {question.options?.map(option => <FormControlLabel key={option.id} value={option.id} control={<Radio />} label={option.label} />)}
        <FormControlLabel value="dont_know" control={<Radio />} label={t("teacher:dont_know")} />
      </RadioGroup>
    </FormControl> : <>
      <TextInput label={t("teacher:your_answer")} value={answer?.kind === "completion" || answer?.kind === "short_text" ? answer.text : ""} onChange={event => change({ kind: question.kind === "short_text" ? "short_text" : "completion", text: event.target.value })} disabled={disabled || !editable} error={answer !== null && !draft.valid} helperText={answer !== null && !draft.valid ? t("teacher:answer_length") : undefined} multiline={question.kind === "short_text"} minRows={question.kind === "short_text" ? 3 : 1} />
      <Button variant={answer?.kind === "dont_know" ? "contained" : "outlined"} disabled={disabled || !editable} onClick={() => change({ kind: "dont_know" })}>{t("teacher:dont_know")}</Button>
    </>}
    {onReflectionSave && <ResponseReflection value={{ self_explanation: question.self_explanation ?? null, confidence: question.confidence ?? null }} disabled={disabled || !editable} canSave={Boolean(question.response_id) && !draft.dirty} onDirty={setReflectionDirty} onSave={onReflectionSave} />}
    {(answer || draft.dirty || draft.saving) && <Typography role="status" variant="body2" color={draft.dirty || draft.status === "save_failed" ? "warning.main" : "text.secondary"}>{t(question.frozen_answer ? "teacher:response_submitted" : `teacher:${draft.status}`)}</Typography>}
    {question.frozen_answer && ["pending", "needs_review"].includes(question.grade_state ?? "") && <Alert severity="info">{t("teacher:feedback_pending")}</Alert>}
    {draft.status === "conflict" && <Alert severity="warning">{t("teacher:answer_conflict", { answer: displayAnswer(draft.confirmedAnswer) })}</Alert>}
    <Actions>
      <Button variant="outlined" disabled={disabled || !editable || !answer || !draft.dirty || !draft.valid} onClick={() => void draft.save()}>{t("teacher:save_answer")}</Button>
      {!final && <Button variant="contained" disabled={disabled || !canSubmit || !complete || !draft.valid || reflectionDirty || Boolean(question.frozen_answer)} onClick={() => { if (answer) void onSubmit(answer); }}>{t("teacher:submit_answer")}</Button>}
    </Actions>
    {final && !delivered && <Alert severity="info">{t("teacher:final_no_feedback")}</Alert>}
    {feedback && <Feedback>
      <Typography variant="subtitle1" component="h4">{t("teacher:feedback")}</Typography>
      {question.frozen_answer && <Typography>{t("teacher:your_answer_value", { answer: displayAnswer(question.frozen_answer) || t("teacher:dont_know") })}</Typography>}
      {feedback.correct_answer !== undefined && displayAnswer(feedback.correct_answer) && <Typography>{t("teacher:correct_answer", { answer: displayAnswer(feedback.correct_answer) })}</Typography>}
      {feedback.expected_explanation && <Typography>{t("teacher:correct_answer", { answer: feedback.expected_explanation })}</Typography>}
      {feedback.explanation ? <Typography sx={{ whiteSpace: "pre-wrap" }}>{feedback.explanation}</Typography> : <Typography>{t("teacher:explanation_pending")}</Typography>}
      {feedback.earned_points !== undefined && feedback.earned_points !== null && feedback.max_points !== undefined && <Typography>{t("teacher:points", { earned: feedback.earned_points, possible: feedback.max_points })}</Typography>}
      {feedback.criteria?.map(criterion => <Typography key={criterion.criterion_id} variant="body2">{t("teacher:criterion", { criterion: t(`teacher:criteria.${criterion.criterion_id}`), points: criterion.points, comment: criterion.comment })}</Typography>)}
    </Feedback>}
  </QuestionBody>;
}
import { useEffect, useState } from "react";
