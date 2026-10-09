import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import { useTranslation } from "react-i18next";
import type { ConsoleView } from "./types";
import { ConsolePaper, EventLog } from "./styles";

export default function AnalysisConsole({ view }: { view: ConsoleView }) {
  const { t, i18n } = useTranslation("business");
  const log = useRef<HTMLDivElement>(null);
  const follows = useRef(true);
  const [showRecent, setShowRecent] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const busy = ['reserving', 'analyzing', 'preparing'].includes(view.phase);
  const lastEventKey = view.events.at(-1)?.key;
  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (follows.current && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [view.events.length, lastEventKey]);
  const elapsed = view.startedAt ? Math.max(0, Math.floor((now - view.startedAt) / 1000)) : 0;
  const last = view.events.at(-1);
  const sinceLast = last ? Math.max(0, Math.floor((now - Date.parse(last.occurredAt)) / 1000)) : 0;
  return (
    <ConsolePaper elevation={0} role="region" aria-label={t("business:analysis_console_title")} data-testid="analysis-console">
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
          <TerminalOutlinedIcon color="primary" />
          <Typography variant="subtitle2" sx={{ flex: 1 }}>{t("business:analysis_console_title")}</Typography>
          <Chip size="small" label={t(`business:analysis_phase_${view.phase}`)}
            color={view.phase === 'ready' ? 'success' : view.phase === 'failed' ? 'error' : 'default'} />
        </Stack>
        {view.identity && <Typography variant="caption" component="p" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
          {t("business:analysis_console_identity", { provider: view.identity.provider,
            mode: view.identity.mode ? t(`business:analysis_mode_${view.identity.mode}`) : t("business:analysis_console_unknown"),
            model: view.identity.model ?? t("business:analysis_console_no_model") })}
        </Typography>}
        {view.startedAt && <Typography variant="caption" color="text.secondary">{t("business:analysis_console_elapsed", { seconds: elapsed })}</Typography>}
      </Box>
      {busy && <LinearProgress aria-label={t("business:analysis_console_processing")}
        variant={view.uploadPercent !== null && view.uploadPercent < 100 ? 'determinate' : 'indeterminate'}
        value={view.uploadPercent ?? undefined} />}
      {view.observationError && <Alert severity="warning" action={<Button size="small" disabled={view.isFetching} onClick={view.resume}>{t("business:analysis_console_resume")}</Button>}>
        {t("business:analysis_console_disconnected")}
      </Alert>}
      {view.phase === 'uncertain' && <Alert severity="warning">{t("business:analysis_console_uncertain")}</Alert>}
      {view.gap && <Alert severity="info">{t("business:analysis_console_gap")}</Alert>}
      <EventLog ref={log} role="log" aria-label={t("business:analysis_console_events")} aria-live="polite" aria-relevant="additions" tabIndex={0}
        onScroll={() => { if (!log.current) return; follows.current = log.current.scrollHeight - log.current.scrollTop - log.current.clientHeight < 40; setShowRecent(!follows.current); }}>
        {!view.events.length && <Stack sx={{ height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }} spacing={1}>
          <TerminalOutlinedIcon sx={{ fontSize: 36, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">{t("business:analysis_console_empty")}</Typography>
        </Stack>}
        {view.events.map(event => {
          const Icon = event.severity === 'error' || event.severity === 'warning' ? ErrorOutlineIcon :
            ['extraction_validated', 'draft_ready'].includes(event.stage) ? CheckCircleOutlineIcon : RadioButtonUncheckedIcon;
          return <Stack key={event.key} direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'flex-start' }}>
            <Icon sx={{ mt: .25, fontSize: 16, color: event.severity === 'error' ? 'error.main' : event.severity === 'warning' ? 'warning.main' : event.stage === 'draft_ready' || event.stage === 'extraction_validated' ? 'success.main' : 'text.secondary' }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">{t(`business:analysis_event_${event.stage}`)}</Typography>
              <Typography component="time" dateTime={event.occurredAt} variant="caption" color="text.secondary">
                {new Date(event.occurredAt).toLocaleTimeString(i18n.language)}
              </Typography>
            </Box>
          </Stack>;
        })}
      </EventLog>
      {showRecent && <Button size="small" onClick={() => { follows.current = true; setShowRecent(false); if (log.current) log.current.scrollTop = log.current.scrollHeight; }}>{t("business:analysis_console_recent")}</Button>}
      {busy && sinceLast >= 10 && <Typography variant="caption" sx={{ px: 2, pb: 1 }} color="text.secondary">{t("business:analysis_console_waiting", { seconds: sinceLast })}</Typography>}
      {view.correlation && <Typography variant="caption" sx={{ px: 2, pb: 1, overflowWrap: 'anywhere' }} color="text.secondary">{t("business:analysis_console_correlation", { id: view.correlation })}</Typography>}
    </ConsolePaper>
  );
}

