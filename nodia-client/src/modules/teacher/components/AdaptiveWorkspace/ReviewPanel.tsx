import EnrichmentPaging from "./EnrichmentPaging";
import { useEffect, useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../components/inputs/TextInput";
import LessonMarkdown from "../LessonMarkdown";
import type { ReviewCard } from "../../infrastructure/enrichmentSchemas";
import { reviewDueDate } from "../../infrastructure/reviewPresentation";
import { useEnrichment } from "./useEnrichment";
import PanelState from "./PanelState";
import type { AdaptivePanelProps } from "./types";

function ReviewItem({ card, disabled, readDisabled, rate }: { card: ReviewCard; disabled: boolean; readDisabled: boolean; rate: (rating: number) => Promise<unknown> }) {
  const { t, i18n } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const knownPolicy = card.policy_version === undefined || card.policy_version === "teacher-intervals/1";
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  return <Stack sx={{ gap: 1, p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
    <LessonMarkdown text={card.question} />
    <Typography variant="caption">{t(`teacher:adaptive.review_states.${card.state}`)} · {t("teacher:adaptive.due_at_zone", { value: reviewDueDate(card.due_at, card.timezone, i18n.language) ?? t("teacher:adaptive.unknown"), timezone: card.timezone })}</Typography>
    {!knownPolicy && <Alert severity="info">{t("teacher:adaptive.unsupported_review_policy")}</Alert>}
    {revealed ? <><LessonMarkdown text={card.answer} /><Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1 }}>{([1, 2, 3, 4] as const).map(value => <Button key={value} variant="outlined" disabled={disabled || !knownPolicy || !Number.isFinite(Date.parse(card.due_at)) || Date.parse(card.due_at) > clock} onClick={() => void rate(value)}>{t(`teacher:adaptive.ratings.${value}`)}</Button>)}</Stack></> : <Button variant="outlined" disabled={readDisabled} onClick={() => setRevealed(true)}>{t("teacher:adaptive.reveal")}</Button>}
  </Stack>;
}

export default function ReviewPanel(props: AdaptivePanelProps) {
  const { t } = useTranslation();
  const { query, disabled, readDisabled, execute, page, setPage } = useEnrichment(props);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const data = query.data;
  return <PanelState loading={query.isLoading && !data} fetching={query.isFetching} error={query.isError} retry={query.refetch}>
    <Alert severity="info">{t("teacher:adaptive.review_notice")}</Alert>
    {data && <Stack sx={{ gap: 2 }}>
      {!data.review_cards.length && <Typography color="text.secondary">{t("teacher:adaptive.empty")}</Typography>}
      {data.review_cards.map(card => <ReviewItem key={`${card.id}:${card.revision}`} card={card} disabled={disabled} readDisabled={readDisabled} rate={rating => execute("review_rate", { card_id: card.id, expected_card_revision: card.revision, rating })} />)}
      <Typography variant="h6" component="h3">{t("teacher:adaptive.create_card")}</Typography>
      <TextInput label={t("teacher:adaptive.question")} value={question} multiline disabled={disabled} onChange={event => setQuestion(event.target.value)} />
      <TextInput label={t("teacher:adaptive.expected_answer")} value={answer} multiline disabled={disabled} onChange={event => setAnswer(event.target.value)} />
      <TextInput label={t("teacher:adaptive.timezone")} value={timezone} disabled={disabled} onChange={event => setTimezone(event.target.value)} />
      <Button variant="contained" disabled={disabled || !question.trim() || question.length > 2000 || !answer.trim() || answer.length > 2000 || !timezone.trim()} onClick={async () => { if (await execute("card_create", { question, answer, timezone })) { setQuestion(""); setAnswer(""); } }}>{t("teacher:adaptive.save_card")}</Button>
      {data.has_more && <Alert severity="info">{t("teacher:adaptive.bounded_list")}</Alert>}
    </Stack>}
    {query.data && <EnrichmentPaging page={page} hasMore={query.data.has_more} disabled={readDisabled} onPage={setPage} />}
  </PanelState>;
}
