import { Skeleton } from "boneyard-js/react";
import { useImperativeHandle, type Ref } from "react";
import { Alert, Box, Button, LinearProgress, Typography } from "@mui/material";
import BaseModal from "../../../../../../components/BaseModal";
import { ConfirmDialog } from "../../../../../../components/ConfirmDialog/ConfirmDialog";
import type { CodexSession } from "../../infrastructure/codexSession";
import { useCodexSession } from "./hooks/useCodexSession";
import { SessionActions, SessionContent } from "./styles";
import {
  DetailPanel,
  PanelHeader,
  PanelTitle,
  PanelSubtitle,
} from "../ProviderDetail/styles";

type Props = {
  ref?: Ref<{ manage: () => void }>;
  providerId: string;
  session?: CodexSession;
  disabled: boolean;
};

const CodexSessionPanel = ({ ref, providerId, session, disabled }: Props) => {
  const {
    t,
    sessionObservation,
    open,
    disconnect,
    setDisconnect,
    busy,
    current,
    status,
    job,
    active,
    effectiveId,
    connect,
    close,
    handleLogout,
    manage,
  } = useCodexSession(providerId, disabled);
  useImperativeHandle(ref, () => ({ manage }));
  const currentSession = open && job?.state !== "succeeded" ? sessionObservation.data ?? session : session;
  return (
    <DetailPanel>
      <PanelHeader>
        <Box>
          <PanelTitle>{t("ai_providers:codex.title")}</PanelTitle>
          <PanelSubtitle>{t("ai_providers:codex.subtitle")}</PanelSubtitle>
        </Box>
        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            width: { xs: "100%", sm: "auto" },
          }}
        >
          <Button
            variant="outlined"
            disabled={busy}
            onClick={manage}
            sx={{ width: { xs: "100%", sm: "auto" } }}
          >
            {t("ai_providers:codex.manage")}
          </Button>
          {currentSession?.authenticated && (
            <Button
              color="error"
              disabled={busy}
              onClick={() => setDisconnect(true)}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            >
              {t("ai_providers:codex.disconnect")}
            </Button>
          )}
        </Box>
      </PanelHeader>
      <Skeleton loading={sessionObservation.isLoading}>
        <Box>
          <Typography role="status">
            {t(
              currentSession?.authenticated === true
                ? "ai_providers:codex.connected"
                : currentSession?.authenticated === false
                  ? "ai_providers:codex.session_required"
                  : "ai_providers:codex.unknown",
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {currentSession?.lastInferenceAt
              ? t("ai_providers:codex.inference_observed", {
                  date: currentSession.lastInferenceAt,
                })
              : t("ai_providers:codex.inference_unverified")}
          </Typography>
          {currentSession?.usageAllowed === false && (
            <Alert severity="warning">
              {t("ai_providers:codex.quota_exhausted")}
            </Alert>
          )}
          {currentSession?.quotas?.map((bucket) => (
            <Box
              key={bucket.id}
              sx={{ display: "flex", flexDirection: "column", gap: 1 }}
            >
              <Typography variant="subtitle2">
                {bucket.name ?? bucket.id}
              </Typography>
              {(["primary", "secondary"] as const).map((key) => {
                const w = bucket[key];
                return w?.usedPercent == null ? null : (
                  <Typography key={key} variant="body2">
                    {t("ai_providers:codex.quota_window", {
                      window:
                        w.windowDurationMins == null
                          ? t("ai_providers:codex.window_unknown")
                          : t("ai_providers:codex.minutes", {
                              count: w.windowDurationMins,
                            }),
                      percent: w.usedPercent,
                    })}
                  </Typography>
                );
              })}
            </Box>
          ))}
        </Box>
      </Skeleton>
      {open && job?.state !== "succeeded" && (
        <BaseModal
          open
          onClose={close}
          showCloseButton={!busy}
          size="sm"
          title={t("ai_providers:codex.title")}
          actions={
            <SessionActions>
              <Button disabled={busy} onClick={close}>
                {t(
                  active
                    ? "ai_providers:codex.cancel"
                    : "ai_providers:codex.close",
                )}
              </Button>
              <Button
                variant="contained"
                disabled={busy || active || current.isError || status.isError}
                onClick={connect}
              >
                {t("ai_providers:codex.connect")}
              </Button>
            </SessionActions>
          }
        >
          <SessionContent>
            <Alert severity="info">
              {t("ai_providers:codex.shared_session")}
            </Alert>
            <Typography variant="body2">
              {t("ai_providers:codex.instructions")}
            </Typography>
            {busy && <LinearProgress />}
            {job && (
              <Typography role="status">
                {t(`ai_providers:codex.states.${job.state}`)}
              </Typography>
            )}
            {job?.state === "waiting_authorization" && job.verificationUrl && (
              <>
                <Button
                  component="a"
                  href={job.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  disabled={busy}
                >
                  {t("ai_providers:codex.open_login")}
                </Button>
                <Typography
                  component="code"
                  sx={{
                    fontFamily: "monospace",
                    fontSize: "1.5rem",
                    textAlign: "center",
                  }}
                >
                  {job.userCode}
                </Typography>
              </>
            )}
            {job?.state === "failed" && (
              <Alert severity="error">
                {t("ai_providers:codex.failure_description")}
              </Alert>
            )}
            {(current.isError ||
              status.isError ||
              sessionObservation.isError) && (
              <Alert
                severity="error"
                action={
                  <Button
                    disabled={busy}
                    onClick={() =>
                      sessionObservation.isError
                        ? sessionObservation.refetch()
                        : effectiveId
                          ? status.refetch()
                          : current.refetch()
                    }
                  >
                    {t("core:retry")}
                  </Button>
                }
              >
                {t("core:server_error_toast")}
              </Alert>
            )}
          </SessionContent>
        </BaseModal>
      )}
      <ConfirmDialog
        open={disconnect}
        onClose={() => setDisconnect(false)}
        onConfirm={handleLogout}
        isLoading={busy}
        title={t("ai_providers:codex.disconnect")}
        message={t("ai_providers:codex.disconnect_confirm")}
      />
    </DetailPanel>
  );
};
export default CodexSessionPanel;
