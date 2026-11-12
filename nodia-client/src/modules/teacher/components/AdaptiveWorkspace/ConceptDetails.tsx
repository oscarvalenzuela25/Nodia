import { useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { conceptSchema, sourceContentSchema } from "../../infrastructure/enrichmentSchemas";
import { questionSchema } from "../../infrastructure/schemas";
import { useTeacherQuery } from "../../infrastructure/useServices";
import PanelState from "./PanelState";
import LessonMarkdown from "../LessonMarkdown";
import { answerText } from "../../infrastructure/presentation";

export default function ConceptDetails({ sessionId, conceptId, visible }: { sessionId: string; conceptId: string; visible: boolean }) {
  const { t } = useTranslation();
  const query = useTeacherQuery(`sessions/${sessionId}/enrichment/concepts/${conceptId}`, conceptSchema, undefined, visible);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<{ attempt_id: string; question_id: string } | null>(null);
  const source = useTeacherQuery(`sessions/${sessionId}/enrichment/sources/${sourceId}`, sourceContentSchema, undefined, visible && sourceId !== null);
  const question = useTeacherQuery(`sessions/${sessionId}/attempts/${origin?.attempt_id}/questions/${origin?.question_id}`, questionSchema, undefined, visible && origin !== null);
  const state = query.data?.learning_state;
  const optionId = question.data?.frozen_answer?.kind === "single_choice" ? question.data.frozen_answer.option_id : null;
  const originalAnswer = optionId === null ? answerText(question.data?.frozen_answer) : question.data?.options?.find(option => option.id === optionId)?.label ?? optionId;
  return <PanelState loading={query.isLoading && !query.data} fetching={query.isFetching} error={query.isError} retry={query.refetch}>
    {query.data && <Stack sx={{ gap: 1, minWidth: 0, overflowWrap: "anywhere" }}>
      <Alert severity="info">{t("teacher:adaptive.concept_observations_notice")}</Alert>
      <Stack component="dl" sx={{ m: 0, gap: 1 }}>
        {(["visited", "immediate_check", "independent_application", "retention", "section_verification"] as const).map(key => <Stack key={key} direction={{ xs: "column", sm: "row" }} sx={{ gap: 1 }}><Typography component="dt" sx={{ fontWeight: 600 }}>{t(`teacher:adaptive.concept_states.${key}`)}</Typography><Typography component="dd" sx={{ m: 0 }}>{t(state?.[key] ? "teacher:adaptive.observed" : "teacher:adaptive.observation_unknown")}</Typography></Stack>)}
      </Stack>
      {state?.latest_evidence.map(item => <Stack key={item.id} sx={{ gap: .5 }}>
        <Typography>{t(`teacher:adaptive.grade.${item.answer_state}`)} · {t(item.independent ? "teacher:adaptive.independent" : item.assisted ? "teacher:adaptive.assisted" : "teacher:adaptive.unknown")}</Typography>
        {item.earned_points !== null && <Typography>{t("teacher:points", { earned: item.earned_points, possible: item.max_points })}</Typography>}
        <Typography component="time" dateTime={item.observed_at} variant="caption">{new Date(item.observed_at).toLocaleString()}</Typography>
        {state.evidence_origins?.filter(ref => ref.observation_id === item.id).map(ref => <Button key={ref.response_id} variant="outlined" disabled={question.isFetching} onClick={() => setOrigin(ref)}>{t("teacher:adaptive.inspect_response")}</Button>)}
      </Stack>)}
      {origin && <PanelState loading={question.isLoading && !question.data} fetching={question.isFetching} error={question.isError} retry={question.refetch}>{question.data && <Stack sx={{ gap: 1 }}><Typography variant="subtitle1">{question.data.prompt}</Typography><Typography>{t("teacher:adaptive.response_reference", { value: question.data.response_id })}</Typography><Typography>{t("teacher:your_answer_value", { answer: originalAnswer || t("teacher:adaptive.unknown") })}</Typography>{question.data.self_explanation && <LessonMarkdown text={question.data.self_explanation} />}{question.data.feedback?.explanation && <LessonMarkdown text={question.data.feedback.explanation} />}</Stack>}</PanelState>}
      {(query.data.relations ?? []).map((relation, index) => <Stack key={index} sx={{ gap: .5 }}><Typography sx={{ fontWeight: 600 }}>{t(`teacher:adaptive.relation_kinds.${relation.kind}`)}</Typography><Typography variant="body2">{t("teacher:adaptive.proposed_relation_notice")}</Typography>{relation.targets.map(target => <Stack key={target.id}><Typography>{target.label}</Typography><Typography>{target.statement}</Typography><Typography variant="body2" color="text.secondary">{target.conditions}</Typography></Stack>)}</Stack>)}
      {(query.data.source_refs ?? []).map((reference, index) => <Stack key={index} sx={{ gap: .5 }}><Typography component="blockquote" sx={{ m: 0, pl: 2, borderLeft: 2, borderColor: "divider" }}>{reference.quote}</Typography><Typography variant="caption">{t("teacher:adaptive.page", { number: reference.page })} · {reference.content_hash}</Typography><Button variant="outlined" disabled={source.isFetching} onClick={() => setSourceId(reference.source_id)}>{t("teacher:adaptive.inspect_source")}</Button></Stack>)}
      {(query.data.equivalence_history ?? []).map(item => <Stack key={item.id}><Typography>{t("teacher:adaptive.equivalence_history")}: {t(`teacher:adaptive.equivalence_states.${item.next_state}`)}</Typography><Typography component="time" dateTime={item.observed_at} variant="caption">{new Date(item.observed_at).toLocaleString()}</Typography></Stack>)}
      {sourceId && <PanelState loading={source.isLoading && !source.data} fetching={source.isFetching} error={source.isError} retry={source.refetch}>{source.data && <Stack><Typography variant="subtitle1" component="h4">{source.data.title}</Typography>{source.data.pages.map(page => <Stack key={page.page}><Typography>{t("teacher:adaptive.page", { number: page.page })}</Typography><Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{page.text}</Typography></Stack>)}</Stack>}</PanelState>}
    </Stack>}
  </PanelState>;
}
