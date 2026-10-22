import { useCallback, useEffect, useId, useState } from "react";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import { Link } from "react-router";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { useNodiaAiEvents, useNodiaAiHistoricalRun, useNodiaAiObservation } from "../../infrastructure/useObservation";
import type { NodiaAiEvent, NodiaAiRun } from "../../infrastructure/types";
import { Observation, ResultCard } from "./styles";
import { nodiaAiObservationDestination } from "./navigation";
import ProposalPreview from "../ProposalPreview";
import ReportObservation from "../ReportObservation";

const sourceLabels: Record<string, string> = {
  businesses: "business:title", personal_finance: "finance:title", rental_reservations: "rental:title",
  ai_providers: "ai_providers:title", users: "users:title", roles: "roles:title", actions: "actions:title", modules: "modules:title",
};

function SavedObservation({ event }: { event: Extract<NodiaAiEvent, { kind: "tool_completed" }> }) {
  const { t, i18n } = useTranslation("nodiaAi");
  const query = useNodiaAiObservation(event.payload.result_ref, true);
  const result = query.data;
  const observedDate = (value: string) => new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <>
      {query.isFetching && !query.isLoading && <LinearProgress aria-label={t("refreshing")} />}
      {query.isError && <Alert severity="error" action={<Button disabled={query.isFetching} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t(query.accessRejected ? "observation.result_restricted" : "observation.result_error")}</Alert>}
      <Skeleton loading={query.isLoading}>
        {result && <>
          <Typography variant="body2">{t("observation.source", { source: i18n.exists(result.source.description_key) ? i18n.t(result.source.description_key) : sourceLabels[result.source.module_key] && i18n.exists(sourceLabels[result.source.module_key]) ? i18n.t(sourceLabels[result.source.module_key]) : "Nodia" })}</Typography>
          <Typography component="p" variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}><time dateTime={result.observed_at}>{t("observation.observed_at", { date: observedDate(result.observed_at) })}</time></Typography>
          <Typography component="p" variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>{t("observation.historical")}</Typography>
          {result.summary.total !== null && <Typography variant="body2">{t("observation.total", { value: result.summary.total })}</Typography>}
          {result.summary.returned !== null && <Typography variant="body2">{t("observation.returned", { count: result.summary.returned })}</Typography>}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, minWidth: 0 }}>
            {result.navigation.map((item, index) => {
              const destination = nodiaAiObservationDestination(item);
              return destination ? <Button component={Link} key={`${destination}:${index}`} to={destination} variant="outlined" disabled={query.isFetching}>{item.label ?? t("observation.open_record")}</Button> : null;
            })}
          </Box>
        </>}
      </Skeleton>
    </>;
}

function ToolObservation({ event, observed }: { event: Extract<NodiaAiEvent, { kind: "tool_completed" }>; observed: boolean }) {
  const { t } = useTranslation("nodiaAi");
  const [opened, setOpened] = useState(false);
  const resultId = useId();
  return <ResultCard>
    <Typography component="h4" variant="subtitle2">{t(`observation.tool_states.${event.payload.state}`)}</Typography>
    {event.payload.state === "completed" && <Button variant="text" aria-expanded={opened} aria-controls={resultId} onClick={() => setOpened(value => !value)}>{t(opened ? "observation.hide_result" : "observation.show_result")}</Button>}
    <div id={resultId} hidden={!opened}>{opened && observed && (event.payload.result_ref.tool_name === "nodia_reports_run" ? <ReportObservation resultRef={event.payload.result_ref} /> : <SavedObservation event={event} />)}</div>
  </ResultCard>;
}

function ProposalObservation({ event, observed, onBusyChange }: { event: Extract<NodiaAiEvent, { kind: "proposal_ready" }>; observed: boolean; onBusyChange: (id: string, busy: boolean) => void }) {
  const { t } = useTranslation("nodiaAi");
  const [opened, setOpened] = useState(false);
  const [visited, setVisited] = useState(false);
  const [busy, setBusy] = useState(false);
  const previewId = useId();
  useEffect(() => { onBusyChange(event.event_id, busy); return () => onBusyChange(event.event_id, false); }, [busy, event.event_id, onBusyChange]);
  return <ResultCard>
    <Typography component="h4" variant="subtitle2">{t("proposal.available")}</Typography>
    <Button disabled={busy} aria-expanded={opened} aria-controls={previewId} onClick={() => { setVisited(true); setOpened(value => !value); }}>{t(opened ? "proposal.hide" : "proposal.show")}</Button>
    <div id={previewId} hidden={!opened}>{visited && <ProposalPreview conversationId={event.conversation_id} proposalRef={event.payload} visible={opened && observed} onBusyChange={setBusy} />}</div>
  </ResultCard>;
}

export default function ExecutionObservation({ conversationId, run, observed = true, onBusyChange }: { conversationId: string; run: NodiaAiRun; observed?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const { t, i18n } = useTranslation("nodiaAi");
  const query = useNodiaAiEvents(conversationId, run, observed);
  const [busyProposals, setBusyProposals] = useState<Record<string, boolean>>({});
  const proposalBusy = useCallback((id: string, busy: boolean) => setBusyProposals(previous => previous[id] === busy ? previous : { ...previous, [id]: busy }), []);
  const busy = Object.values(busyProposals).some(Boolean);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const events = query.data?.items ?? [];
  return <Observation aria-label={t("observation.title")}>
    <Typography component="h3" variant="subtitle2">{t("observation.title")}</Typography>
    {query.isFetching && !query.isLoading && <LinearProgress aria-label={t("observation.refreshing")} />}
    {query.isError && <Alert severity="error" action={<Button disabled={query.isFetching} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t("observation.events_error")}</Alert>}
    {query.data?.reset && <Alert severity="info" action={<Button disabled={query.isFetching} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t("observation.reset")}</Alert>}
    <Skeleton loading={query.isLoading}>
      {!events.length && !query.isLoading && !query.isError && <Typography variant="body2" color="text.secondary">{t("observation.empty")}</Typography>}
      {events.map(event => event.kind === "tool_completed" ? <ToolObservation key={event.event_id} event={event} observed={observed} /> : event.kind === "proposal_ready" ? <ProposalObservation key={event.event_id} event={event} observed={observed} onBusyChange={proposalBusy} /> : <Box key={event.event_id}>
        <Typography variant="body2">{event.kind === "run_changed" ? t(`states.${event.payload.state}`) : event.kind === "run_stage_changed" ? t("observation.stage", { mode: t(`modes.${event.payload.stage.selection.mode}`) }) : t(`observation.events.${event.kind}`)}</Typography>
        <Typography variant="caption" color="text.secondary"><time dateTime={event.created_at}>{new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</time></Typography>
      </Box>)}
    </Skeleton>
  </Observation>;
}

function HistoricalRun({ conversationId, runId, observed, onBusyChange }: { conversationId: string; runId: string; observed: boolean; onBusyChange: (busy: boolean) => void }) {
  const { t } = useTranslation("nodiaAi");
  const query = useNodiaAiHistoricalRun(conversationId, runId, observed);
  return <>
    {query.isError && <Alert severity="error" action={<Button disabled={query.isFetching} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t("observation.events_error")}</Alert>}
    <Skeleton loading={query.isLoading}>
      {query.data && <ExecutionObservation conversationId={conversationId} run={query.data} observed={observed} onBusyChange={onBusyChange} />}
    </Skeleton>
  </>;
}

export function HistoricalObservation({ conversationId, runId }: { conversationId: string; runId: string }) {
  const { t } = useTranslation("nodiaAi");
  const [opened, setOpened] = useState(false);
  const [visited, setVisited] = useState(false);
  const [busy, setBusy] = useState(false);
  const activityId = useId();
  return <Box sx={{ mt: 1, minWidth: 0 }}>
    <Button disabled={busy} aria-expanded={opened} aria-controls={activityId} sx={{ minHeight: 44, width: { xs: "100%", sm: "auto" } }} onClick={() => { setVisited(true); setOpened(value => !value); }}>{t(opened ? "observation.hide_activity" : "observation.show_activity")}</Button>
    <div id={activityId} hidden={!opened}>{visited && <HistoricalRun conversationId={conversationId} runId={runId} observed={opened} onBusyChange={setBusy} />}</div>
  </Box>;
}
