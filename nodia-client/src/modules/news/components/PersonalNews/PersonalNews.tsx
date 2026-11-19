import { useEffect, useId, useRef, useState } from "react";
import { Alert, Button, LinearProgress, Link, Stack, Typography } from "@mui/material";
import AddLinkOutlinedIcon from "@mui/icons-material/AddLinkOutlined";
import FeedOutlinedIcon from "@mui/icons-material/FeedOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import { NewsIntroduction, NewsMasthead, NewsRetryAlert, NewsTitle } from "../../styles";
import NewsInitialLoading from "../NewsInitialLoading";
import PersonalArticleCard from "./PersonalArticleCard";
import PersonalNewsConnectionDialog from "./PersonalNewsConnectionDialog";
import PersonalNewsPanel from "./PersonalNewsPanel";
import { personalNewsErrorKey } from "./services";
import { allPersonalTopics, getPersonalReading, type PersonalTopic } from "./topics";
import { personalProviderSchema, type PersonalProvider } from "./types";
import { usePersonalNews } from "./usePersonalNews";
import {
  ConnectionState, EmptyReading, PersonalArticleList, PersonalRoot, ProviderMark, ReadingFilters, SourceActions,
  SourceCard, SourceGrid,
} from "./styles";

const dev = "dev-community";
const daily = "daily-dev";
const providerNames: Record<PersonalProvider, string> = {
  "dev-community": "DEV Community",
  "daily-dev": "daily.dev",
};
type SourceDialog = { provider: PersonalProvider; operation: "connect" | "reconnect" | "disconnect" };

export default function PersonalNews({ actorKey }: { actorKey: string }) {
  const { t, i18n } = useTranslation(["news", "core"]);
  const id = useId();
  const topicInputId = `${id}-topic`;
  const [provider, setProvider] = useState<PersonalProvider>();
  const [topic, setTopic] = useState<PersonalTopic>(allPersonalTopics);
  const [dailyTopic, setDailyTopic] = useState<PersonalTopic>(allPersonalTopics);
  const [dialog, setDialog] = useState<SourceDialog | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const restoreSourceHeading = useRef<PersonalProvider | null>(null);
  const personal = usePersonalNews(actorKey, provider);
  const { active, action, articles, available, connections, readingProvider } = personal;
  const busy = !active || action !== null || connections.isFetching || articles.isFetching;
  const sources = connections.data?.connections ?? [];
  const readingSettings = available.find((source) => source.provider === readingProvider);
  const sourceItems = (articles.data?.items ?? []).filter((item) => item.provider === readingProvider);
  const readingTopic = readingProvider === daily ? dailyTopic : topic;
  const setReadingTopic = readingProvider === daily ? setDailyTopic : setTopic;
  const reading = getPersonalReading(sourceItems, readingTopic);
  const readingConnectionError = !connections.data && connections.isError;
  const readingError = readingConnectionError || articles.isError;
  const readingReady = connections.data && (!readingProvider || (articles.data && !articles.isPlaceholderData));
  const topicOptions: { value: PersonalTopic; label: string }[] = [
    { value: allPersonalTopics, label: t("news:topic_all") },
    ...reading.groups.map(({ value, label }) => ({ value, label: t(label) })),
    ...reading.tags.map((tag) => ({ value: `tag:${tag}` as const, label: `#${tag}` })),
  ];
  const dates = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const noFollowedTags = readingProvider === dev && readingSettings?.snapshot_status === "no_followed_tags";
  const emptySnapshot = readingSettings?.snapshot_status === "empty";

  useEffect(() => {
    const source = restoreSourceHeading.current;
    if (dialog || !source) return;
    // The original button no longer exists after a successful connect or disconnect.
    const frame = requestAnimationFrame(() => {
      restoreSourceHeading.current = null;
      document.getElementById(`${id}-${source}`)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [dialog, id]);

  const close = () => {
    setDialog(null);
    setDisconnectError(null);
  };
  const resetSourceTopic = (source: PersonalProvider) => {
    if (source === daily) setDailyTopic(allPersonalTopics);
    else setTopic(allPersonalTopics);
  };

  const disconnect = async () => {
    if (dialog?.operation !== "disconnect") return;
    const source = dialog.provider;
    setDisconnectError(null);
    const result = await personal.disconnect(source);
    if (result.ok) {
      restoreSourceHeading.current = source;
      close();
      if (provider === source) setProvider(undefined);
      resetSourceTopic(source);
    } else if (result.message) {
      setDisconnectError(result.message);
    }
  };

  return (
    <PersonalRoot aria-labelledby={`${id}-title`} aria-busy={busy}>
      <NewsMasthead>
        <NewsTitle id={`${id}-title`}>{t("news:personal_title")}</NewsTitle>
        <NewsIntroduction>{t("news:personal_subtitle")}</NewsIntroduction>
      </NewsMasthead>

      <PersonalNewsPanel title={t("news:personal_sources")}>
        <Typography variant="body2" color="text.secondary">
          {t(available.length > 0 ? "news:personal_sources_connected" : "news:personal_sources_hint")}
        </Typography>
        {connections.isPending && !connections.data && <NewsInitialLoading />}
        {connections.isError && (
          <NewsRetryAlert severity="error" action={
            <Button variant="outlined" color="inherit" size="small" disabled={busy} onClick={() => void connections.refetch()}>
              {t("core:retry")}
            </Button>
          }>
            {t("news:personal_connections_failed")}
          </NewsRetryAlert>
        )}
        {connections.data && (
          <SourceGrid>
            {sources.map((source) => {
              const name = providerNames[source.provider];
              const isDaily = source.provider === daily;
              const supported = source.state !== "pending";
              const connected = source.state === "connected";
              const reconnectRequired = source.state === "reconnect_required";
              const canManage = connected || reconnectRequired;
              const sourceAction = action?.provider === source.provider ? action.operation : undefined;
              const heading = `${id}-${source.provider}`;
              const stateTime = source.last_tested_at;
              return (
                <SourceCard key={source.provider} aria-labelledby={heading}>
                  <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
                    <ProviderMark aria-hidden="true">{source.provider === dev ? "DEV" : "d."}</ProviderMark>
                    <div>
                      <Typography
                        component="h3" variant="subtitle1" id={heading} sx={{ fontWeight: 700 }}
                        tabIndex={-1}
                      >
                        {name}
                      </Typography>
                      <ConnectionState role="status" data-connected={connected}>
                        {t(`news:personal_state_${source.state}`)}
                      </ConnectionState>
                    </div>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {t(source.provider === dev ? "news:personal_dev_description" : "news:personal_daily_description")}
                  </Typography>
                  {isDaily && supported && (
                    <Typography variant="body2">
                      <Link href="https://daily.dev/" target="_blank" rel="noopener noreferrer">
                        {t("news:personal_open_daily")}
                      </Link>
                    </Typography>
                  )}
                  {source.state === "pending" && (
                    <Typography variant="body2" color="text.secondary">
                      {t(source.provider === dev ? "news:personal_dev_pending" : "news:personal_daily_pending")}
                    </Typography>
                  )}
                  {(source.account_name || source.key_hint) && (
                    <Stack sx={{ gap: 0.5 }}>
                      {source.account_name && <Typography variant="caption">
                        {t(isDaily ? "news:personal_daily_account" : "news:personal_account", { account: source.account_name })}
                      </Typography>}
                      {source.key_hint && <Typography variant="caption">
                        {t("news:personal_key_saved", { mask: source.key_hint })}
                      </Typography>}
                    </Stack>
                  )}
                  {stateTime && (
                    <Typography variant="caption" color="text.secondary">
                      {t("news:personal_tested_at", { date: dates.format(new Date(stateTime)) })}
                    </Typography>
                  )}
                  {source.last_refresh_success_at && (
                    <Typography variant="caption" color="text.secondary">
                      {t("news:personal_updated_at", { date: dates.format(new Date(source.last_refresh_success_at)) })}
                    </Typography>
                  )}
                  {source.last_test_error_code && <Alert severity="warning">
                    {t(personalNewsErrorKey(source.last_test_error_code, source.provider))}
                  </Alert>}
                  {source.last_refresh_error_code && <Alert severity="warning">
                    {t(personalNewsErrorKey(source.last_refresh_error_code, source.provider))}
                    {source.next_refresh_at && (
                      <Typography component="p" variant="caption">
                        {t(source.retry_source === "provider" ? "news:personal_retry_provider" : "news:personal_retry_local", {
                          date: dates.format(new Date(source.next_refresh_at)),
                        })}
                      </Typography>
                    )}
                  </Alert>}
                  {supported && (
                    <SourceActions>
                      {!canManage && (
                        <Button variant="outlined" disabled={busy} startIcon={<AddLinkOutlinedIcon />}
                          onClick={() => setDialog({ provider: source.provider, operation: "connect" })}>
                          {t(isDaily ? "news:personal_connect_daily" : "news:personal_connect_dev")}
                        </Button>
                      )}
                      {connected && (
                        <>
                          <Button variant="contained" disabled={busy} startIcon={<RefreshOutlinedIcon />}
                            loading={sourceAction === "refresh"} onClick={() => void personal.refresh(source.provider)}>
                            {t("news:personal_refresh")}
                          </Button>
                          <Button variant="outlined" disabled={busy}
                            loading={sourceAction === "test"} onClick={() => void personal.test(source.provider)}>
                            {t("news:personal_test")}
                          </Button>
                        </>
                      )}
                      {canManage && (
                        <>
                          <Button variant="outlined" disabled={busy}
                            onClick={() => setDialog({ provider: source.provider, operation: "reconnect" })}>
                            {t("news:personal_reconnect")}
                          </Button>
                          <Button variant="outlined" color="error" disabled={busy}
                            onClick={() => setDialog({ provider: source.provider, operation: "disconnect" })}>
                            {t("news:personal_disconnect")}
                          </Button>
                        </>
                      )}
                    </SourceActions>
                  )}
                </SourceCard>
              );
            })}
          </SourceGrid>
        )}
      </PersonalNewsPanel>

      <PersonalNewsPanel title={t("news:personal_reading")}>
        {readingProvider && (
          <ReadingFilters>
            <SelectSingleInput
              id={`${id}-filter`}
              label={t("news:source")}
              value={readingProvider}
              clearable={false}
              options={available.map((source) => ({ value: source.provider, label: providerNames[source.provider] }))}
              disabled={busy}
              onChange={(value) => {
                const result = personalProviderSchema.safeParse(value);
                if (result.success) setProvider(result.data);
              }}
            />
            {reading.canFilterTopics && (
              <SelectSingleInput
                id={topicInputId}
                label={t("news:topic")}
                value={readingTopic}
                clearable={false}
                options={topicOptions}
                disabled={busy}
                onChange={(value) => {
                  const selection = topicOptions.find((option) => option.value === value);
                  if (selection) setReadingTopic(selection.value);
                }}
              />
            )}
          </ReadingFilters>
        )}
        {readingProvider === daily && (
          <Typography component="p" variant="subtitle1" sx={{ fontWeight: 650 }}>
            {t("news:personal_daily_reading")}
          </Typography>
        )}
        {readingReady && !readingError && reading.missingTags && (
          <Alert severity="info" role="status" sx={{ "& .MuiAlert-message": { width: "100%" } }}>
            <Stack sx={{
              gap: 1,
              "@container personal-news (min-width: 620px)": {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              },
            }}>
              <Typography variant="body2">{t("news:personal_topic_legacy_hint")}</Typography>
              <Button
                variant="outlined" color="inherit" size="small" sx={{ minHeight: 44, flexShrink: 0 }}
                disabled={busy} loading={action?.provider === dev && action.operation === "refresh"}
                onClick={() => void personal.refresh(dev)}
              >
                {t("news:personal_topic_refresh_dev")}
              </Button>
            </Stack>
          </Alert>
        )}
        {(connections.isPending || (readingProvider && articles.isPending)) && <NewsInitialLoading />}
        {articles.isFetching && articles.data && <LinearProgress aria-label={t("news:loading")} />}
        {readingError && (
          <NewsRetryAlert severity="error" action={
            <Button variant="outlined" color="inherit" size="small" disabled={busy}
              onClick={() => void (readingConnectionError ? connections.refetch() : articles.refetch())}>
              {t("core:retry")}
            </Button>
          }>
            {t(readingConnectionError ? "news:personal_connections_failed" : "news:personal_articles_failed")}
          </NewsRetryAlert>
        )}
        {readingReady && !readingError && reading.items.length === 0 && (
          <EmptyReading role="status">
            <FeedOutlinedIcon aria-hidden="true" color="action" />
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 650 }}>
              {t(reading.noTopicMatches ? "news:personal_topic_empty"
                : noFollowedTags ? "news:personal_refresh_no_followed_tags"
                  : emptySnapshot ? "news:personal_refresh_empty" : "news:personal_empty_title")}
            </Typography>
            {reading.noTopicMatches ? (
              <Button variant="text" disabled={busy} onClick={() => {
                setReadingTopic(allPersonalTopics);
                document.getElementById(topicInputId)?.focus();
              }}>
                {t("news:personal_topic_reset")}
              </Button>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  {t(noFollowedTags ? "news:personal_empty_follow_tags"
                    : readingProvider === daily ? "news:personal_daily_empty"
                      : readingProvider ? "news:personal_empty_connected" : "news:personal_empty_disconnected")}
                </Typography>
                {noFollowedTags && (
                  <Link href="https://dev.to/tags" target="_blank" rel="noopener noreferrer">
                    {t("news:personal_open_dev_tags")}
                  </Link>
                )}
              </>
            )}
          </EmptyReading>
        )}
        {reading.items.length > 0 && (
          <PersonalArticleList role="list">
            {reading.items.map((item) => (
              <li key={`${item.provider}:${item.id}`}>
                <PersonalArticleCard article={item} providerName={providerNames[item.provider]} dates={dates} />
              </li>
            ))}
          </PersonalArticleList>
        )}
      </PersonalNewsPanel>

      {(dialog?.operation === "connect" || dialog?.operation === "reconnect") && (
        <PersonalNewsConnectionDialog
          key={dialog.provider}
          provider={dialog.provider}
          reconnect={dialog.operation === "reconnect"}
          busy={action !== null}
          active={active}
          onClose={close}
          onConnect={async (key) => {
            const result = await personal.connect(dialog.provider, key);
            if (result.ok) {
              if (dialog.operation === "connect") restoreSourceHeading.current = dialog.provider;
              resetSourceTopic(dialog.provider);
            }
            return result;
          }}
        />
      )}
      <ConfirmDialog
        open={dialog?.operation === "disconnect"}
        title={t(dialog?.provider === daily ? "news:personal_disconnect_daily" : "news:personal_disconnect_dev")}
        message={t(dialog?.provider === daily ? "news:personal_disconnect_daily_description" : "news:personal_disconnect_description")}
        confirmText={t("news:personal_disconnect")}
        onClose={close}
        onConfirm={disconnect}
        isLoading={action?.operation === "disconnect"}
        confirmDisabled={!active}
      >
        {disconnectError && <Alert severity="error">{disconnectError}</Alert>}
      </ConfirmDialog>
    </PersonalRoot>
  );
}
