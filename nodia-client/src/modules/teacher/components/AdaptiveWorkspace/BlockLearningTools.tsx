import { useId, useRef, useState, type ReactNode } from "react";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import TipsAndUpdatesOutlined from "@mui/icons-material/TipsAndUpdatesOutlined";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import type { LessonInteraction } from "../../infrastructure/learningSchemas";
import { matchesStudyAnswer, type parseStudyPractice } from "../../infrastructure/studyPractice";
import LessonMarkdown from "../LessonMarkdown";
import { PracticeActions, PracticeDisclosure, PracticeForm, PracticeItem, PracticeReference, PracticeSurface } from "./blockLearningStyles";
import type { AdaptivePanelProps } from "./types";

type Practice = ReturnType<typeof parseStudyPractice>;
type Props = Omit<AdaptivePanelProps, "visible" | "onPractice" | "command"> & {
  command: Pick<AdaptivePanelProps["command"], "execute">;
  contentVersionId: string;
  history?: LessonInteraction[];
  block: { id: string; kind?: string };
  practice: Practice;
};

type Draft = { text: string; answers: string[]; checked: string[] | null; reviewing: boolean };
const emptyDraft: Draft = { text: "", answers: [], checked: null, reviewing: false };
const maxResponseLength = 2000;

function reviewCriteriaMarkdown(markdown: string): string {
  const question = /¿[^?\r\n]+\?/g;
  const questions = markdown.match(question);
  if (!questions || questions.length < 2 || !/^[\s,;]*$/.test(markdown.replace(question, ""))) return markdown;
  return questions.map(text => `- ${text}`).join("\n");
}

function ReferenceDisclosure({ label, markdown, blockId }: {
  label: "hint" | "solution" | "criteria";
  markdown: string;
  blockId: string;
}) {
  const { t } = useTranslation("teacher");
  const id = useId();
  const [open, setOpen] = useState(false);

  return <Box>
    <PracticeDisclosure variant="outlined" aria-expanded={open} aria-controls={id}
      startIcon={label === "hint" ? <TipsAndUpdatesOutlined fontSize="small" /> : undefined}
      endIcon={<ExpandMoreOutlined sx={{ rotate: open ? "180deg" : undefined }} />}
      onClick={() => setOpen(value => !value)}>
      {t(`study_practice.${label}_${open ? "hide" : "show"}`)}
    </PracticeDisclosure>
    <div id={id} hidden={!open}>
      {open && <PracticeReference data-lesson-topic-text={blockId}><LessonMarkdown text={markdown} /></PracticeReference>}
    </div>
  </Box>;
}

function FillPractice({ blockId, fields, draft, patchDraft, disabled, saveButton, saveLimitReached }: {
  blockId: string;
  fields: Practice["fields"];
  draft: Draft;
  patchDraft: (patch: Partial<Draft>) => void;
  disabled: boolean;
  saveButton?: ReactNode;
  saveLimitReached: boolean;
}) {
  const { t } = useTranslation("teacher");
  const id = useId();
  const answers = fields.map((_, index) => draft.answers[index] ?? "");
  const complete = answers.every(answer => answer.trim());
  const results = fields.map((field, index) => draft.checked?.[index] === answers[index]
    ? matchesStudyAnswer(answers[index], field.answer) : undefined);
  const evaluated = results.every(result => result !== undefined);
  const correct = results.filter(result => result === true).length;

  return <PracticeForm aria-labelledby={`${id}-title`} onSubmit={event => {
    event.preventDefault();
    if (!disabled && complete) patchDraft({ checked: answers });
  }}>
    <Stack sx={{ gap: .5 }}>
      <Typography id={`${id}-title`} component="h4" variant="subtitle1" sx={{ fontWeight: 700 }}>{t("study_practice.fill_title")}</Typography>
      <Typography variant="body2" color="text.secondary">{t("study_practice.fill_help")}</Typography>
    </Stack>
    {fields.map((field, index) => {
      const promptId = `${id}-${index}-prompt`;
      const feedbackId = `${id}-${index}-feedback`;
      const result = results[index];
      return <PracticeItem key={promptId}>
        <Box id={promptId} data-lesson-topic-text={blockId} sx={{ "& p": { my: 0 } }}><LessonMarkdown text={field.promptMarkdown} /></Box>
        <TextInput label={t("study_practice.answer_number", { number: index + 1 })}
          value={answers[index]} disabled={disabled} error={result === false}
          aria-describedby={result === undefined ? promptId : `${promptId} ${feedbackId}`}
          onChange={event => patchDraft({ answers: answers.map((answer, position) => position === index ? event.target.value : answer) })} />
        {result !== undefined && <Typography id={feedbackId} variant="body2" color={result ? "success.main" : "error.main"}>
          {t(result ? "study_practice.matches" : "study_practice.try_again")}
        </Typography>}
      </PracticeItem>;
    })}
    {saveLimitReached && <Alert severity="warning">{t("study_practice.character_limit", { limit: maxResponseLength })}</Alert>}
    <PracticeActions>
      <Button type="submit" variant="contained" startIcon={<FactCheckOutlined />} disabled={disabled || !complete}>
        {t("study_practice.check_answers")}
      </Button>
      {saveButton}
    </PracticeActions>
    <div role="status" aria-atomic="true">
      {evaluated && <Alert role="presentation" severity={correct === fields.length ? "success" : "info"}>
        {t(correct === fields.length ? "study_practice.all_match" : "study_practice.some_match", { correct, total: fields.length })}
      </Alert>}
    </div>
  </PracticeForm>;
}

export default function BlockLearningTools({ block, practice, session, contentVersionId, history, command, onResult, busy }: Props) {
  const { t } = useTranslation("teacher");
  const answerId = useId();
  const reviewId = useId();
  const contextKey = JSON.stringify([session.id, contentVersionId, block.id]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const draft = drafts[contextKey] ?? emptyDraft;
  const patchDraft = (patch: Partial<Draft>) => setDrafts(current => ({ ...current, [contextKey]: { ...(current[contextKey] ?? emptyDraft), ...patch } }));
  const finalActive = session.active_attempts.some(attempt => attempt.scope === "section_final" && attempt.state === "in_progress");
  const disabled = busy || saving || session.state === "paused" || session.state === "archived";
  const interactionKind = block.kind === "prediction" || block.kind === "check" ? block.kind : null;
  const fills = practice.fields.length > 0;
  const open = !fills && (interactionKind !== null || block.kind === "guided_practice");
  const completeFills = fills && practice.fields.every((_, index) => draft.answers[index]?.trim());
  const text = fills && completeFills ? practice.fields.map((_, index) => `${index + 1}. ${draft.answers[index].trim()}`).join("\n") : draft.text;
  const overLimit = text.length > maxResponseLength;
  const canSave = !disabled && Boolean(text.trim()) && !overLimit;
  const showReview = open && draft.reviewing;

  if (finalActive || (!open && !fills && !practice.hintMarkdown && !practice.solutionMarkdown && !practice.criteriaMarkdown)) return null;

  const prior = history?.filter(item => item.content_version_id === contentVersionId && item.block_id === block.id) ?? [];
  const save = async () => {
    if (!interactionKind || !canSave || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await command.execute(`sessions/${session.id}/learning/interactions`, {
        expected_session_revision: session.revision,
        content_version_id: contentVersionId,
        block_id: block.id,
        kind: interactionKind,
        text,
      });
      if (result) { patchDraft(emptyDraft); onResult(result); }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const saveButton = interactionKind && <Button type="button" variant="outlined" disabled={!canSave} loading={saving} onClick={() => void save()}>
    {t("adaptive.save_interaction")}
  </Button>;

  return <Stack key={contextKey} sx={{ gap: 2 }}>
    {interactionKind && history === undefined && <Alert severity="info">{t("adaptive.block_history_unavailable")}</Alert>}
    {interactionKind && prior.map(item => <PracticeReference key={item.id} sx={{ mt: 0 }}>
      <Typography variant="caption" color="text.secondary">{t("adaptive.saved_block_response")}</Typography>
      <LessonMarkdown text={item.text} />
    </PracticeReference>)}
    {practice.hintMarkdown && <ReferenceDisclosure label="hint" markdown={practice.hintMarkdown} blockId={block.id} />}
    {fills && <FillPractice blockId={block.id} fields={practice.fields} draft={draft} patchDraft={patchDraft} disabled={disabled}
      saveButton={saveButton} saveLimitReached={Boolean(interactionKind && overLimit)} />}
    {open && <PracticeSurface>
      <Typography variant="body2" color="text.secondary">{t(interactionKind ? "study_practice.open_help" : "study_practice.local_attempt_help")}</Typography>
      <TextInput id={answerId} label={t(interactionKind === "prediction" ? "adaptive.prediction" : "study_practice.open_answer")}
        placeholder={t("study_practice.open_placeholder")} value={draft.text} disabled={disabled} multiline rows={3}
        error={Boolean(interactionKind && overLimit)}
        helperText={interactionKind ? t(overLimit ? "study_practice.character_limit" : "study_practice.characters", { used: text.length, limit: maxResponseLength }) : undefined}
        onChange={event => patchDraft({ text: event.target.value })} />
      <PracticeActions>
        <Button variant="contained" startIcon={<FactCheckOutlined />} disabled={disabled || !draft.text.trim()}
          aria-expanded={showReview} aria-controls={reviewId} onClick={() => patchDraft({ reviewing: !showReview })}>
          {t(showReview ? "study_practice.review_hide" : "study_practice.review_open")}
        </Button>
        {saveButton}
      </PracticeActions>
      <div id={reviewId} hidden={!showReview}>
        {showReview && <Alert severity="info" role="region" aria-labelledby={`${reviewId}-title`}>
          <Stack sx={{ gap: 1 }}>
            <Typography id={`${reviewId}-title`} component="h4" variant="subtitle2">{t("study_practice.review_title")}</Typography>
            {practice.criteriaMarkdown ? <><Typography variant="body2">{t("study_practice.review_help")}</Typography>
              <Box data-lesson-topic-text={block.id}><LessonMarkdown text={reviewCriteriaMarkdown(practice.criteriaMarkdown)} /></Box>
            </> : <Typography variant="body2">{t("study_practice.review_fallback")}</Typography>}
            <Typography variant="body2" color="text.secondary">{t("study_practice.review_no_grade")}</Typography>
            <PracticeActions>
              <Button variant="text" disabled={disabled} onClick={() => document.getElementById(answerId)?.focus()}>{t("study_practice.improve")}</Button>
            </PracticeActions>
          </Stack>
        </Alert>}
      </div>
    </PracticeSurface>}
    {!open && practice.criteriaMarkdown && <ReferenceDisclosure label="criteria" markdown={practice.criteriaMarkdown} blockId={block.id} />}
    {practice.solutionMarkdown && <ReferenceDisclosure label="solution" markdown={practice.solutionMarkdown} blockId={block.id} />}
  </Stack>;
}
