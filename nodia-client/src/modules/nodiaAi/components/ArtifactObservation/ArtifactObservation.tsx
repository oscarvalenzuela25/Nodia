import { useEffect, useRef, useState } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import useAuth from "../../../../hooks/useAuth";
import useAuthStore, { hasActiveSession } from "../../../../store/authStore";
import { notifyHttpError } from "../../../../config/httpFeedback";
import { artifactRefSchema } from "../../infrastructure/artifactSchemas";
import { downloadNodiaAiArtifact } from "../../infrastructure/artifactServices";
import type { NodiaAiArtifactRef } from "../../infrastructure/artifactSchemas";
import type { NodiaAiToolResultRef } from "../../infrastructure/types";
import { ArtifactCard } from "./styles";

function ArtifactDownload({ reference, ownerId, sessionVersion, enabled }: { reference: NodiaAiArtifactRef; ownerId: string | undefined; sessionVersion: number; enabled: boolean }) {
  const { t } = useTranslation("nodiaAi");
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);
  const active = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const releases = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    active.current = true;
    const localReleases = releases.current;
    return () => {
      active.current = false;
      pending.current?.abort();
      localReleases.forEach((timer, url) => { clearTimeout(timer); URL.revokeObjectURL(url); });
      localReleases.clear();
    };
  }, []);
  const download = async () => {
    if (!enabled || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setDownloading(true);
    setFailed(false);
    try {
      const file = await downloadNodiaAiArtifact(reference, controller.signal);
      const auth = useAuthStore.getState();
      if (!active.current || controller.signal.aborted || !hasActiveSession(auth) || auth.user?.id !== ownerId || auth.sessionVersion !== sessionVersion) return;
      const url = URL.createObjectURL(file.blob);
      const timer = setTimeout(() => { URL.revokeObjectURL(url); releases.current.delete(url); }, 1000);
      releases.current.set(url, timer);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
      sileo.success({ title: t("artifacts.download_ready") });
    } catch (error) {
      if (active.current && !controller.signal.aborted) { setFailed(true); notifyHttpError(error); }
    } finally {
      if (active.current) { pending.current = null; setDownloading(false); }
    }
  };
  return <ArtifactCard>
    <Typography component="h5" variant="subtitle2">{t(`artifacts.tools.${reference.tool_name}`)}</Typography>
    <Typography variant="body2" color="text.secondary">{t("artifacts.current_on_download")}</Typography>
    {failed && <Alert severity="error">{t("artifacts.download_error")}</Alert>}
    <Button variant="contained" loading={downloading} disabled={!enabled || downloading} onClick={() => void download()}>{t(failed ? "artifacts.retry" : "artifacts.download")}</Button>
  </ArtifactCard>;
}

/** The key discards private in-flight state on chat, reference or authenticated identity changes. */
export default function ArtifactObservation({ conversationId, resultRef }: { conversationId: string; resultRef: NodiaAiToolResultRef }) {
  const { t } = useTranslation("nodiaAi");
  const { user, sessionVersion, isSessionActive } = useAuth();
  const reference = artifactRefSchema.safeParse(resultRef);
  if (!reference.success) return <Alert severity="error">{t("artifacts.download_error")}</Alert>;
  return <ArtifactDownload key={`${user?.id}:${sessionVersion}:${isSessionActive}:${conversationId}:${resultRef.tool_call_id}:${resultRef.tool_name}:${resultRef.contract_hash}`}
    reference={reference.data} ownerId={user?.id} sessionVersion={sessionVersion} enabled={isSessionActive && Boolean(user?.id)} />;
}
