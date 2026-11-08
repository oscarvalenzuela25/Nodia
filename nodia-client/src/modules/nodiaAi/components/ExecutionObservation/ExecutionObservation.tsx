import { useCallback, useEffect, useId, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRounded from "@mui/icons-material/ExpandLessRounded";
import { Link } from "react-router";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import { useNodiaAiEvents, useNodiaAiHistoricalRun, useNodiaAiObservation } from "../../infrastructure/useObservation";
import type { NodiaAiEvent, NodiaAiRun } from "../../infrastructure/types";
import { Observation, ResultCard, ProposalCard, ProposalCardHeader, ProposalCardIdentity, ProposalCardIcon, ProposalCardToggle, ProposalCardContent } from "./styles";
import { nodiaAiObservationDestination } from "./navigation";
import ProposalPreview from "../ProposalPreview";
import ReportObservation from "../ReportObservation";
import ArtifactObservation from "../ArtifactObservation";
import { isNodiaAiArtifactTool } from "../../infrastructure/artifactSchemas";
import RunActivity from "../RunActivity";

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
      {query.isError && <Alert severity="error" action={<Button variant="contained" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t(query.accessRejected ? "observation.result_restricted" : "observation.result_error")}</Alert>}
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
    {event.payload.state === "completed" && <Button variant="contained" aria-expanded={opened} aria-controls={resultId} onClick={() => setOpened(value => !value)}>{t(opened ? "observation.hide_result" : "observation.show_result")}</Button>}
    <div id={resultId} hidden={!opened}>{opened && observed && (event.payload.result_ref.tool_name === "nodia_reports_run" ? <ReportObservation resultRef={event.payload.result_ref} /> : isNodiaAiArtifactTool(event.payload.result_ref.tool_name) ? <ArtifactObservation conversationId={event.conversation_id} resultRef={event.payload.result_ref} /> : <SavedObservation event={event} />)}</div>
  </ResultCard>;
}

function ProposalObservation({ event, observed, onBusyChange }: { event: Extract<NodiaAiEvent, { kind: "proposal_ready" }>; observed: boolean; onBusyChange: (id: string, busy: boolean) => void }) {
  const { t } = useTranslation("nodiaAi");
  const [opened, setOpened] = useState(false);
  const [visited, setVisited] = useState(false);
  const [busy, setBusy] = useState(false);
  const previewId = useId();
  useEffect(() => { onBusyChange(event.event_id, busy); return () => onBusyChange(event.event_id, false); }, [busy, event.event_id, onBusyChange]);
  return <ProposalCard data-open={opened}>
    <ProposalCardHeader>
      <ProposalCardIdentity>
        <ProposalCardIcon aria-hidden="true"><FactCheckOutlined /></ProposalCardIcon>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h4" variant="h6" sx={{ fontWeight: 700 }}>{t("proposal.card_title")}</Typography>
          <Typography variant="body2" color="text.secondary">{t("proposal.card_description")}</Typography>
        </Box>
      </ProposalCardIdentity>
      <ProposalCardToggle variant="outlined" disabled={busy} aria-expanded={opened} aria-controls={previewId} endIcon={opened ? <ExpandLessRounded /> : <ExpandMoreRounded />} onClick={() => { setVisited(true); setOpened(value => !value); }}>{t(opened ? "proposal.hide" : "proposal.show")}</ProposalCardToggle>
    </ProposalCardHeader>
    <ProposalCardContent id={previewId} hidden={!opened}>{visited && <ProposalPreview conversationId={event.conversation_id} proposalRef={event.payload} visible={opened && observed} onBusyChange={setBusy} />}</ProposalCardContent>
  </ProposalCard>;
}

export default function ExecutionObservation({ conversationId, run, observed = true, historical = false, onBusyChange, onProgress, activityControls }: { conversationId: string; run: NodiaAiRun; observed?: boolean; historical?: boolean; onBusyChange?: (busy: boolean) => void; onProgress?: () => void; activityControls?: ReactNode }) {
  const { t } = useTranslation("nodiaAi");
  const query = useNodiaAiEvents(conversationId, run, observed);
  const [busyProposals, setBusyProposals] = useState<Record<string, boolean>>({});
  const proposalBusy = useCallback((id: string, busy: boolean) => setBusyProposals(previous => previous[id] === busy ? previous : { ...previous, [id]: busy }), []);
  const busy = Object.values(busyProposals).some(Boolean);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  const events = query.data?.items ?? [];
  const lastEventId = events.at(-1)?.event_id;
  useEffect(() => { onProgress?.(); }, [lastEventId, onProgress, run.state]);
  const results = events.filter(event => event.kind === "tool_completed" || event.kind === "proposal_ready");
  const working = ["queued", "running", "waiting_for_user", "cancel_requested"].includes(run.state);
  // A finished greeting has no secondary output. Its lifecycle is not a chat message.
  if (!working && !results.length && !historical && !query.isError && !query.data?.reset) return null;
  return <Observation aria-label={t("observation.title")}>
    <RunActivity run={run} events={events}>{activityControls}</RunActivity>
    {query.isError && <Alert severity="error" action={<Button variant="contained" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t("observation.events_error")}</Alert>}
    {query.data?.reset && <Alert severity="info" action={<Button variant="contained" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t("observation.reset")}</Alert>}
    <Skeleton loading={!working && query.isLoading}>
      {historical && !results.length && !query.isLoading && !query.isError && <Typography variant="body2" color="text.secondary">{t("observation.empty")}</Typography>}
      {results.map(event => event.kind === "tool_completed" ? <ToolObservation key={event.event_id} event={event} observed={observed} /> : event.kind === "proposal_ready" ? <ProposalObservation key={event.event_id} event={event} observed={observed} onBusyChange={proposalBusy} /> : null)}
    </Skeleton>
  </Observation>;
}

function HistoricalRun({ conversationId, runId, observed, onBusyChange }: { conversationId: string; runId: string; observed: boolean; onBusyChange: (busy: boolean) => void }) {
  const { t } = useTranslation("nodiaAi");
  const query = useNodiaAiHistoricalRun(conversationId, runId, observed);
  return <>
    {query.isError && <Alert severity="error" action={<Button variant="contained" disabled={query.isFetching} onClick={() => void query.refetch()}>{t("retry")}</Button>}>{t("observation.events_error")}</Alert>}
    <Skeleton loading={query.isLoading}>
      {query.data && <ExecutionObservation conversationId={conversationId} run={query.data} observed={observed} historical onBusyChange={onBusyChange} />}
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
    <Button variant="contained" disabled={busy} aria-expanded={opened} aria-controls={activityId} sx={{ minHeight: 44, width: { xs: "100%", sm: "auto" } }} onClick={() => { setVisited(true); setOpened(value => !value); }}>{t(opened ? "observation.hide_activity" : "observation.show_activity")}</Button>
    <div id={activityId} hidden={!opened}>{visited && <HistoricalRun conversationId={conversationId} runId={runId} observed={opened} onBusyChange={setBusy} />}</div>
  </Box>;
}
